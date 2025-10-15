from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_restx import Api, Resource, fields, Namespace
from datetime import datetime
import requests
import os

app = Flask(__name__)
# Используем переменную окружения или дефолтное значение
# Определяем абсолютный путь к БД
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'SQLALCHEMY_DATABASE_URI', 
    f'sqlite:///{os.path.join(basedir, "instance", "bazar_monitoring.db")}'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Настройка CORS для разрешения запросов с file:// протокола
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Swagger документация
api = Api(
    app,
    version='1.0',
    title='Bazar Monitoring API',
    description='API для мониторинга базаров Узбекистана с автоматическим логированием событий',
    doc='/docs/',  # Swagger UI будет доступен по /docs/
    contact='Bazar Monitoring Team',
    contact_email='admin@bazar-monitoring.uz',
    license='MIT',
    license_url='https://opensource.org/licenses/MIT'
)

db = SQLAlchemy(app)

# Модели базы данных
class BazarLog(db.Model):
    """Лог изменений статуса базара и административных действий"""
    id = db.Column(db.Integer, primary_key=True)
    bazar_name = db.Column(db.String(200), nullable=False)
    bazar_ip = db.Column(db.String(50), nullable=False)
    bazar_port = db.Column(db.Integer, nullable=False)
    city = db.Column(db.String(100))
    status = db.Column(db.String(20), nullable=False)  # online/offline/added/updated/deleted
    previous_status = db.Column(db.String(20))
    error_message = db.Column(db.Text)
    action_type = db.Column(db.String(50))  # status_change/service_added/service_updated/service_deleted
    action_details = db.Column(db.Text)  # JSON с деталями действия
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'bazar_name': self.bazar_name,
            'bazar_ip': self.bazar_ip,
            'bazar_port': self.bazar_port,
            'city': self.city,
            'status': self.status,
            'previous_status': self.previous_status,
            'error_message': self.error_message,
            'action_type': self.action_type,
            'action_details': self.action_details,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }

class BazarStatus(db.Model):
    """Текущий статус базара"""
    id = db.Column(db.Integer, primary_key=True)
    bazar_name = db.Column(db.String(200), nullable=False)
    bazar_ip = db.Column(db.String(50), nullable=False)
    bazar_port = db.Column(db.Integer, nullable=False)
    backend_port = db.Column(db.Integer, nullable=False)
    pg_port = db.Column(db.Integer, nullable=False)
    city = db.Column(db.String(100))
    status = db.Column(db.String(20), nullable=False)  # online/offline
    last_online = db.Column(db.DateTime)
    last_offline = db.Column(db.DateTime)
    last_check = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    uptime_percentage = db.Column(db.Float, default=100.0)
    # Контакты
    contact_click = db.Column(db.String(20))        # Контакт от Click
    contact_click_name = db.Column(db.String(100))  # Имя контакта Click
    contact_scc = db.Column(db.String(20))          # Контакт от SCC
    contact_scc_name = db.Column(db.String(100))    # Имя контакта SCC
    # Координаты для карты
    latitude = db.Column(db.Float)   # Широта
    longitude = db.Column(db.Float)  # Долгота
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.bazar_name,
            'ip': self.bazar_ip,
            'port': self.bazar_port,
            'backend_port': self.backend_port,
            'pg_port': self.pg_port,
            'city': self.city,
            'status': self.status,
            'last_online': self.last_online.isoformat() if self.last_online else None,
            'last_offline': self.last_offline.isoformat() if self.last_offline else None,
            'last_check': self.last_check.isoformat() if self.last_check else None,
            'uptime_percentage': self.uptime_percentage,
            'contact_click': self.contact_click,
            'contact_click_name': self.contact_click_name,
            'contact_scc': self.contact_scc,
            'contact_scc_name': self.contact_scc_name,
            'latitude': self.latitude,
            'longitude': self.longitude
        }

# Swagger модели для документации
bazar_ns = Namespace('bazars', description='Операции с базарами')
logs_ns = Namespace('logs', description='Операции с логами')
services_ns = Namespace('services', description='Управление сервисами')
admin_ns = Namespace('admin', description='Административные операции')

api.add_namespace(bazar_ns, path='/api')
api.add_namespace(logs_ns, path='/api')
api.add_namespace(services_ns, path='/api')
api.add_namespace(admin_ns, path='/api')

# Модели для Swagger
bazar_model = api.model('Bazar', {
    'name': fields.String(required=True, description='Название базара'),
    'city': fields.String(description='Город'),
    'status': fields.String(enum=['online', 'offline'], description='Статус базара'),
    'endpoint': fields.Raw(description='Информация об endpoint'),
    'timestamp': fields.DateTime(description='Время последней проверки')
})

bazar_response_model = api.model('BazarResponse', {
    'success': fields.Boolean(description='Успешность операции'),
    'data': fields.List(fields.Nested(bazar_model), description='Список базаров'),
    'total': fields.Integer(description='Общее количество'),
    'online': fields.Integer(description='Количество онлайн'),
    'offline': fields.Integer(description='Количество офлайн')
})

log_model = api.model('Log', {
    'id': fields.Integer(description='ID записи'),
    'bazar_name': fields.String(description='Название базара'),
    'bazar_ip': fields.String(description='IP адрес'),
    'bazar_port': fields.Integer(description='Порт'),
    'city': fields.String(description='Город'),
    'status': fields.String(enum=['online', 'offline'], description='Статус'),
    'previous_status': fields.String(description='Предыдущий статус'),
    'error_message': fields.String(description='Сообщение об ошибке'),
    'timestamp': fields.DateTime(description='Время события')
})

service_model = api.model('Service', {
    'name': fields.String(required=True, description='Название сервиса'),
    'ip': fields.String(required=True, description='IP адрес'),
    'port': fields.Integer(required=True, description='Порт фронтенда'),
    'backend_port': fields.Integer(required=True, description='Порт backend API'),
    'pg_port': fields.Integer(required=True, description='Порт PostgreSQL'),
    'city': fields.String(description='Город'),
    'contact_click': fields.String(description='Контакт Click (+998XXXXXXXXX)'),
    'contact_click_name': fields.String(description='Имя контакта Click'),
    'contact_scc': fields.String(description='Контакт SCC (+998XXXXXXXXX)'),
    'contact_scc_name': fields.String(description='Имя контакта SCC'),
    'latitude': fields.Float(description='Широта (например: 41.291173)'),
    'longitude': fields.Float(description='Долгота (например: 69.274854)')
})

service_response_model = api.model('ServiceResponse', {
    'id': fields.Integer(description='ID сервиса'),
    'name': fields.String(description='Название сервиса'),
    'ip': fields.String(description='IP адрес'),
    'port': fields.Integer(description='Порт фронтенда'),
    'backend_port': fields.Integer(description='Порт backend API'),
    'pg_port': fields.Integer(description='Порт PostgreSQL'),
    'city': fields.String(description='Город'),
    'status': fields.String(description='Статус'),
    'last_online': fields.DateTime(description='Время последнего online'),
    'last_offline': fields.DateTime(description='Время последнего offline'),
    'last_check': fields.DateTime(description='Время последней проверки'),
    'uptime_percentage': fields.Float(description='Процент доступности'),
    'contact_click': fields.String(description='Контакт Click'),
    'contact_click_name': fields.String(description='Имя контакта Click'),
    'contact_scc': fields.String(description='Контакт SCC'),
    'contact_scc_name': fields.String(description='Имя контакта SCC'),
    'latitude': fields.Float(description='Широта'),
    'longitude': fields.Float(description='Долгота')
})

error_model = api.model('Error', {
    'success': fields.Boolean(description='Успешность операции'),
    'error': fields.String(description='Сообщение об ошибке')
})

# Конфигурация базаров
# BAZAR_ENDPOINTS удален - теперь все сервисы добавляются вручную через админскую панель

def fetch_bazar_info(endpoint):
    """Получить информацию о базаре"""
    url = f"http://{endpoint['ip']}:{endpoint['backendPort']}/api/application/bazar-info"
    try:
        response = requests.get(url, timeout=2)
        if response.ok:
            data = response.json()
            return {
                'success': True,
                'data': data,
                'status': 'online',
                'endpoint': endpoint
            }
        else:
            return {
                'success': False,
                'status': 'offline',
                'error': f'HTTP {response.status_code}',
                'endpoint': endpoint
            }
    except Exception as e:
        return {
            'success': False,
            'status': 'offline',
            'error': str(e),
            'endpoint': endpoint
        }

def log_admin_action(service, action_type, details=None):
    """Логировать административное действие (добавление/изменение/удаление сервиса)"""
    import json
    
    log = BazarLog(
        bazar_name=service.get('name', f"{service['ip']}:{service['port']}"),
        bazar_ip=service['ip'],
        bazar_port=service['port'],
        city=service.get('city', 'Unknown'),
        status=action_type,  # added/updated/deleted
        action_type=f'service_{action_type}',
        action_details=json.dumps(details) if details else None,
        timestamp=datetime.utcnow()
    )
    db.session.add(log)
    db.session.commit()

def log_status_change(bazar_data, endpoint, status, error=None):
    """Записать изменение статуса в лог"""
    # Получаем текущий статус из БД
    bazar_id = f"{endpoint['ip']}:{endpoint['port']}"
    current_bazar = BazarStatus.query.filter_by(
        bazar_ip=endpoint['ip'], 
        bazar_port=endpoint['port']
    ).first()
    
    previous_status = current_bazar.status if current_bazar else None
    
    # Логируем только если статус изменился
    if not current_bazar or current_bazar.status != status:
        bazar_name = bazar_data.get('name', f"{endpoint['ip']}:{endpoint['port']}") if bazar_data else f"{endpoint['ip']}:{endpoint['port']}"
        city = bazar_data.get('city', 'Unknown') if bazar_data else 'Unknown'
        
        log = BazarLog(
            bazar_name=bazar_name,
            bazar_ip=endpoint['ip'],
            bazar_port=endpoint['port'],
            city=city,
            status=status,
            previous_status=previous_status,
            error_message=error,
            action_type='status_change',
            timestamp=datetime.utcnow()
        )
        db.session.add(log)
        
    # Обновляем текущий статус
    if current_bazar:
        current_bazar.status = status
        current_bazar.last_check = datetime.utcnow()
        if status == 'online':
            current_bazar.last_online = datetime.utcnow()
            if bazar_data:
                current_bazar.bazar_name = bazar_data.get('name', current_bazar.bazar_name)
                current_bazar.city = bazar_data.get('city', current_bazar.city)
        else:
            current_bazar.last_offline = datetime.utcnow()
    else:
        bazar_name = bazar_data.get('name', f"{endpoint['ip']}:{endpoint['port']}") if bazar_data else f"{endpoint['ip']}:{endpoint['port']}"
        city = bazar_data.get('city', 'Unknown') if bazar_data else 'Unknown'
        
        current_bazar = BazarStatus(
            bazar_name=bazar_name,
            bazar_ip=endpoint['ip'],
            bazar_port=endpoint['port'],
            backend_port=endpoint['backendPort'],
            pg_port=endpoint['pgPort'],
            city=city,
            status=status,
            last_check=datetime.utcnow(),
            last_online=datetime.utcnow() if status == 'online' else None,
            last_offline=datetime.utcnow() if status == 'offline' else None
        )
        db.session.add(current_bazar)
    
    db.session.commit()

# API Routes
@bazar_ns.route('/bazars')
class BazarsResource(Resource):
    @bazar_ns.doc('get_bazars')
    @bazar_ns.marshal_with(bazar_response_model)
    def get(self):
        """Получить статус всех базаров (проверяет напрямую и логирует изменения)"""
        results = []
        
        # Получаем все сервисы из БД
        services = BazarStatus.query.all()
        
        # Если БД пустая, возвращаем пустой список
        if not services:
            return {
                'success': True,
                'data': [],
                'total': 0,
                'online': 0,
                'offline': 0,
                'message': 'Нет добавленных сервисов. Используйте админскую панель для добавления.'
            }
        
        for service in services:
            endpoint = {
                'ip': service.bazar_ip,
                'port': service.bazar_port,
                'backendPort': service.backend_port,
                'pgPort': service.pg_port
            }
            
            result = fetch_bazar_info(endpoint)
            
            if result['success']:
                data = result['data']
                log_status_change(data, endpoint, 'online')
                results.append({
                    'name': data.get('name', service.bazar_name),
                    'city': data.get('city', service.city),
                    'status': 'online',
                    'endpoint': endpoint,
                    'timestamp': datetime.utcnow().isoformat()
                })
            else:
                log_status_change(None, endpoint, 'offline', result.get('error'))
                results.append({
                    'name': service.bazar_name,
                    'city': service.city,
                    'status': 'offline',
                    'error': result.get('error'),
                    'endpoint': endpoint,
                    'timestamp': datetime.utcnow().isoformat()
                })
        
        return {
            'success': True,
            'data': results,
            'total': len(results),
            'online': len([r for r in results if r['status'] == 'online']),
            'offline': len([r for r in results if r['status'] == 'offline'])
        }
    

@logs_ns.route('/logs')
class LogsResource(Resource):
    @logs_ns.doc('get_logs')
    @logs_ns.param('limit', 'Количество записей', type='integer', default=100)
    @logs_ns.param('status', 'Фильтр по статусу', enum=['online', 'offline'])
    def get(self):
        """Получить все логи"""
        limit = request.args.get('limit', 100, type=int)
        status_filter = request.args.get('status', None)
        
        query = BazarLog.query
        
        if status_filter:
            query = query.filter_by(status=status_filter)
        
        logs = query.order_by(BazarLog.timestamp.desc()).limit(limit).all()
        
        return {
            'success': True,
            'data': [log.to_dict() for log in logs],
            'total': len(logs)
        }

@logs_ns.route('/logs/<ip>/<int:port>')
class BazarLogsResource(Resource):
    @logs_ns.doc('get_bazar_logs')
    @logs_ns.param('ip', 'IP адрес базара')
    @logs_ns.param('port', 'Порт базара', type='integer')
    @logs_ns.param('limit', 'Количество записей', type='integer', default=50)
    def get(self, ip, port):
        """Получить логи конкретного базара"""
        limit = request.args.get('limit', 50, type=int)
        
        logs = BazarLog.query.filter_by(
            bazar_ip=ip, 
            bazar_port=port
        ).order_by(BazarLog.timestamp.desc()).limit(limit).all()
        
        return {
            'success': True,
            'data': [log.to_dict() for log in logs],
            'total': len(logs)
        }

@app.route('/api/status', methods=['GET'])
def get_status():
    """Получить текущий статус всех базаров из БД"""
    bazars = BazarStatus.query.all()
    
    return jsonify({
        'success': True,
        'data': [bazar.to_dict() for bazar in bazars],
        'total': len(bazars)
    })

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """Получить статистику"""
    total_bazars = BazarStatus.query.count()
    online_bazars = BazarStatus.query.filter_by(status='online').count()
    offline_bazars = BazarStatus.query.filter_by(status='offline').count()
    
    # Последние изменения статуса
    recent_changes = BazarLog.query.order_by(BazarLog.timestamp.desc()).limit(10).all()
    
    # Подсчет проблемных базаров
    problem_bazars = BazarLog.query.filter_by(status='offline').group_by(
        BazarLog.bazar_ip, BazarLog.bazar_port
    ).all()
    
    return jsonify({
        'success': True,
        'data': {
            'total': total_bazars,
            'online': online_bazars,
            'offline': offline_bazars,
            'uptime_percentage': (online_bazars / total_bazars * 100) if total_bazars > 0 else 0,
            'recent_changes': [log.to_dict() for log in recent_changes],
            'problem_count': len(problem_bazars)
        }
    })

@services_ns.route('/services')
class ServicesResource(Resource):
    @services_ns.doc('get_services')
    def get(self):
        """Получить список всех сервисов из БД"""
        services = BazarStatus.query.all()
        return {
            'success': True,
            'data': [service.to_dict() for service in services],
            'total': len(services)
        }

    @services_ns.doc('add_service')
    @services_ns.expect(service_model)
    @services_ns.marshal_with(service_response_model, code=201)
    @services_ns.marshal_with(error_model, code=400)
    def post(self):
        """Добавить новый сервис"""
        try:
            data = request.get_json()
            
            # Проверяем обязательные поля
            required_fields = ['ip', 'port', 'backend_port', 'pg_port']
            for field in required_fields:
                if field not in data:
                    return {
                        'success': False,
                        'error': f'Поле {field} обязательно'
                    }, 400
            
            # Проверяем что сервис с таким IP:port не существует
            existing = BazarStatus.query.filter_by(
                bazar_ip=data['ip'],
                bazar_port=data['port']
            ).first()
            
            if existing:
                return {
                    'success': False,
                    'error': f'Сервис {data["ip"]}:{data["port"]} уже существует'
                }, 409
            
            # Создаем новый сервис
            new_service = BazarStatus(
                bazar_name=data.get('name', f"{data['ip']}:{data['port']}"),
                bazar_ip=data['ip'],
                bazar_port=data['port'],
                backend_port=data['backend_port'],
                pg_port=data['pg_port'],
                city=data.get('city', 'Unknown'),
                contact_click=data.get('contact_click'),
                contact_click_name=data.get('contact_click_name'),
                contact_scc=data.get('contact_scc'),
                contact_scc_name=data.get('contact_scc_name'),
                latitude=data.get('latitude'),
                longitude=data.get('longitude'),
                status='offline',
                last_check=datetime.utcnow(),
                last_offline=datetime.utcnow()
            )
            
            db.session.add(new_service)
            db.session.commit()
            
            # Логируем добавление сервиса
            log_admin_action(
                service={
                    'name': new_service.bazar_name,
                    'ip': new_service.bazar_ip,
                    'port': new_service.bazar_port,
                    'city': new_service.city
                },
                action_type='added',
                details={
                    'backend_port': new_service.backend_port,
                    'pg_port': new_service.pg_port
                }
            )
            
            return new_service.to_dict(), 201
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500

@services_ns.route('/services/<int:service_id>')
class ServiceResource(Resource):
    @services_ns.doc('update_service')
    @services_ns.expect(service_model)
    @services_ns.marshal_with(service_response_model)
    @services_ns.marshal_with(error_model, code=400)
    def put(self, service_id):
        """Обновить сервис"""
        try:
            service = BazarStatus.query.get_or_404(service_id)
            data = request.get_json()
            
            # Сохраняем старые значения для логирования
            old_values = {
                'name': service.bazar_name,
                'city': service.city,
                'backend_port': service.backend_port,
                'pg_port': service.pg_port
            }
            
            # Обновляем поля
            changes = {}
            if 'name' in data and data['name'] != service.bazar_name:
                changes['name'] = {'old': service.bazar_name, 'new': data['name']}
                service.bazar_name = data['name']
            if 'city' in data and data['city'] != service.city:
                changes['city'] = {'old': service.city, 'new': data['city']}
                service.city = data['city']
            if 'backend_port' in data and data['backend_port'] != service.backend_port:
                changes['backend_port'] = {'old': service.backend_port, 'new': data['backend_port']}
                service.backend_port = data['backend_port']
            if 'pg_port' in data and data['pg_port'] != service.pg_port:
                changes['pg_port'] = {'old': service.pg_port, 'new': data['pg_port']}
                service.pg_port = data['pg_port']
            
            service.last_check = datetime.utcnow()
            db.session.commit()
            
            # Логируем изменение сервиса
            if changes:
                log_admin_action(
                    service={
                        'name': service.bazar_name,
                        'ip': service.bazar_ip,
                        'port': service.bazar_port,
                        'city': service.city
                    },
                    action_type='updated',
                    details={'changes': changes}
                )
            
            return {
                'success': True,
                'message': f'Сервис {service.bazar_ip}:{service.bazar_port} обновлен',
                'data': service.to_dict()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500

    @services_ns.doc('delete_service')
    @services_ns.marshal_with(error_model, code=404)
    def delete(self, service_id):
        """Удалить сервис"""
        try:
            service = BazarStatus.query.get_or_404(service_id)
            service_info = f"{service.bazar_ip}:{service.bazar_port}"
            
            # Сохраняем информацию для логирования перед удалением
            service_data = {
                'name': service.bazar_name,
                'ip': service.bazar_ip,
                'port': service.bazar_port,
                'city': service.city
            }
            
            # Логируем удаление сервиса ПЕРЕД удалением
            log_admin_action(
                service=service_data,
                action_type='deleted',
                details={
                    'backend_port': service.backend_port,
                    'pg_port': service.pg_port,
                    'last_status': service.status
                }
            )
            
            # Удаляем старые логи статуса (но НЕ лог удаления)
            BazarLog.query.filter(
                BazarLog.bazar_ip == service.bazar_ip,
                BazarLog.bazar_port == service.bazar_port,
                BazarLog.action_type == 'status_change'
            ).delete()
            
            # Удаляем сам сервис
            db.session.delete(service)
            db.session.commit()
            
            return {
                'success': True,
                'message': f'Сервис {service_info} удален'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500


@api.route('/health')
class HealthResource(Resource):
    @api.doc('health_check')
    def get(self):
        """Проверка работоспособности API"""
        return {
            'success': True,
            'message': 'Bazar Monitoring API is running',
            'timestamp': datetime.utcnow().isoformat()
        }

@api.route('/')
class IndexResource(Resource):
    @api.doc('api_info')
    def get(self):
        """Информация об API"""
        return {
            'name': 'Bazar Monitoring API',
            'version': '1.0',
            'description': 'API для мониторинга базаров Узбекистана',
            'swagger_docs': '/docs/',
            'endpoints': {
                '/api/bazars': 'GET: Получить статус всех базаров',
                '/api/logs': 'GET: Получить все логи',
                '/api/logs/<ip>/<port>': 'GET: Получить логи конкретного базара',
                '/api/status': 'GET: Получить текущий статус из БД',
                '/api/statistics': 'GET: Получить статистику',
                '/api/services': 'GET: получить все сервисы, POST: добавить сервис',
                '/api/services/<id>': 'PUT: обновить сервис, DELETE: удалить сервис',
                '/api/health': 'GET: Проверка работоспособности'
            }
        }

if __name__ == '__main__':
    with app.app_context():
        # Создаем таблицы если их нет
        db.create_all()
        print("База данных инициализирована")
    
    print("Запуск Bazar Monitoring API на http://localhost:5000")
    print("Swagger документация: http://localhost:5000/docs/")
    app.run(debug=True, host='0.0.0.0', port=5000)


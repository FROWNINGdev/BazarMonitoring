from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_restx import Api, Resource, fields, Namespace
from datetime import datetime
import requests
import os
import logging
import threading
import time

app = Flask(__name__)

# Настройка логирования
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Статичные настройки Telegram бота
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '8511503519:AAEW1sWzwvgjExP9Y6pQMDcflEjhT_a8deE')
# TELEGRAM_CHAT_ID удален - теперь chat ID добавляются только через UI
# Используем переменную окружения или дефолтное значение
# Определяем абсолютный путь к БД
basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, "instance", "bazar_monitoring.db")
db_dir = os.path.dirname(db_path)

# Нормализуем путь для Windows (заменяем обратные слеши на прямые)
db_path = os.path.normpath(db_path)
db_dir = os.path.normpath(db_dir)

# Создаем директорию для базы данных если её нет
if db_dir and not os.path.exists(db_dir):
    try:
        os.makedirs(db_dir, mode=0o755, exist_ok=True)
        logger.info(f"Created database directory: {db_dir}")
    except Exception as e:
        logger.error(f"Failed to create database directory {db_dir}: {e}")

# Для Windows нужно использовать 4 слеша или raw string
if os.name == 'nt':  # Windows
    db_uri = f'sqlite:///{db_path.replace(os.sep, "/")}'
else:
    db_uri = f'sqlite:///{db_path}'

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'SQLALCHEMY_DATABASE_URI', 
    db_uri
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Настройка CORS для разрешения запросов
# Важно: настраиваем CORS до создания Api, чтобы избежать конфликтов
# Используем простую настройку без ресурсов, чтобы избежать дублирования заголовков
CORS(app, 
     origins="*",
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "Accept"],
     expose_headers=["Content-Disposition"],
     supports_credentials=False,
     automatic_options=True
)

# Swagger документация
# Отключаем CORS в Flask-RESTX (cors=False), так как используем Flask-CORS
api = Api(
    app,
    version='1.0',
    title='Bazar Monitoring API',
    description='API для мониторинга базаров Узбекистана с автоматическим логированием событий',
    doc='/docs/',  # Swagger UI будет доступен по /docs/
    contact='Bazar Monitoring Team',
    contact_email='admin@bazar-monitoring.uz',
    license='MIT',
    license_url='https://opensource.org/licenses/MIT',
    cors=False  # Отключаем CORS в Flask-RESTX, используем только Flask-CORS
)

db = SQLAlchemy(app)
migrate = Migrate(app, db)

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
    stream_port = db.Column(db.Integer)  # Порт Stream
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
    # Telegram уведомления
    telegram_notifications_enabled = db.Column(db.Boolean, default=False)  # Включены ли уведомления
    last_offline_cameras_count = db.Column(db.Integer, default=0)  # Последнее количество неработающих камер
    last_notification_time = db.Column(db.DateTime)  # Время последнего уведомления
    notification_check_interval = db.Column(db.Integer, default=3600)  # Интервал проверки в секундах (по умолчанию 1 час)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.bazar_name,
            'ip': self.bazar_ip,
            'port': self.bazar_port,
            'backend_port': self.backend_port,
            'pg_port': self.pg_port,
            'stream_port': self.stream_port,
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
            'longitude': self.longitude,
            'telegram_notifications_enabled': self.telegram_notifications_enabled or False
        }

class TelegramSettings(db.Model):
    """Настройки Telegram бота"""
    id = db.Column(db.Integer, primary_key=True)
    bot_token = db.Column(db.String(200), nullable=False)  # Токен бота
    chat_id = db.Column(db.String(100))  # Chat ID для отправки уведомлений (опционально, основной)
    enabled = db.Column(db.Boolean, default=True)  # Включены ли уведомления
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'bot_token': self.bot_token[:10] + '...' if self.bot_token else None,  # Показываем только начало токена
            'chat_id': self.chat_id,
            'enabled': self.enabled,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class TelegramChatId(db.Model):
    """Chat ID для отправки уведомлений (множественные)"""
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.String(100), nullable=False)  # Только числовой ID (например: -1001234567890 или 123456789)
    chat_type = db.Column(db.String(20), default='channel')  # channel, group, user
    description = db.Column(db.String(200))  # Описание (например, "Основной канал", "Личные уведомления")
    allowed_regions = db.Column(db.Text)  # JSON список разрешенных областей (если None - все области)
    enabled = db.Column(db.Boolean, default=True)
    last_message_id = db.Column(db.Integer, nullable=True)  # ID последнего отправленного сообщения для удаления
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_allowed_regions(self):
        """Получить список разрешенных областей"""
        if not self.allowed_regions:
            return None  # None означает все области
        try:
            import json
            return json.loads(self.allowed_regions)
        except:
            return None
    
    def set_allowed_regions(self, regions):
        """Установить список разрешенных областей"""
        if regions is None or len(regions) == 0:
            self.allowed_regions = None
        else:
            import json
            self.allowed_regions = json.dumps(regions)
    
    def to_dict(self):
        return {
            'id': self.id,
            'chat_id': self.chat_id,
            'chat_type': self.chat_type,
            'description': self.description,
            'allowed_regions': self.get_allowed_regions(),
            'enabled': self.enabled,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Swagger модели для документации
bazar_ns = Namespace('bazars', description='Операции с базарами')
logs_ns = Namespace('logs', description='Операции с логами')
services_ns = Namespace('services', description='Управление сервисами')
admin_ns = Namespace('admin', description='Административные операции')
telegram_ns = Namespace('telegram', description='Настройки Telegram уведомлений')

api.add_namespace(bazar_ns, path='/api')
api.add_namespace(logs_ns, path='/api')
api.add_namespace(services_ns, path='/api')
api.add_namespace(admin_ns, path='/api')
api.add_namespace(telegram_ns, path='/api')

# Модели для Swagger
bazar_model = api.model('Bazar', {
    'name': fields.String(required=True, description='Название базара'),
    'city': fields.String(description='Город'),
    'status': fields.String(enum=['online', 'offline'], description='Статус базара'),
    'endpoint': fields.Raw(description='Информация об endpoint'),
    'contact_click': fields.String(description='Контакт Click'),
    'contact_click_name': fields.String(description='Имя контакта Click'),
    'contact_scc': fields.String(description='Контакт SCC'),
    'contact_scc_name': fields.String(description='Имя контакта SCC'),
    'latitude': fields.Float(description='Широта'),
    'longitude': fields.Float(description='Долгота'),
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
    'stream_port': fields.Integer(description='Порт Stream'),
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
    'stream_port': fields.Integer(description='Порт Stream'),
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
    """Получить информацию о базаре через /api/cameras/statistics"""
    url = f"http://{endpoint['ip']}:{endpoint['backendPort']}/api/cameras/statistics"
    try:
        response = requests.get(url, timeout=2)
        if response.ok:
            data = response.json()
            # Если endpoint доступен, базар онлайн
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

def delete_telegram_message(bot_token, chat_id, message_id):
    """Удалить сообщение в Telegram. Возвращает (success: bool, error: str или None)"""
    try:
        url = f"https://api.telegram.org/bot{bot_token}/deleteMessage"
        params = {
            'chat_id': str(chat_id),
            'message_id': int(message_id)
        }
        
        response = requests.post(url, json=params, timeout=10)
        
        if response.ok:
            result = response.json()
            if result.get('ok'):
                logger.debug(f"Successfully deleted message {message_id} from chat_id {chat_id}")
                return True, None
            else:
                error_desc = result.get('description', 'Unknown error')
                error_code = result.get('error_code', 'N/A')
                error_msg = f"[{error_code}] {error_desc}"
                # Если сообщение уже не найдено, это нормальная ситуация (не логируем как ошибку)
                if 'not found' in error_desc.lower() or 'message to delete not found' in error_desc.lower():
                    logger.debug(f"Message {message_id} from chat_id {chat_id} already deleted or not found (this is normal)")
                    return True, None  # Возвращаем success, так как цель достигнута (сообщения нет)
                logger.warning(f"Failed to delete message {message_id} from chat_id {chat_id}: {error_msg}")
                return False, error_msg
        else:
            try:
                error_data = response.json()
                error_desc = error_data.get('description', response.text)
                error_code = error_data.get('error_code', response.status_code)
                error_msg = f"HTTP {response.status_code}, [{error_code}] {error_desc}"
                # Если сообщение уже не найдено, это нормальная ситуация (не логируем как ошибку)
                if 'not found' in error_desc.lower() or 'message to delete not found' in error_desc.lower():
                    logger.debug(f"Message {message_id} from chat_id {chat_id} already deleted or not found (this is normal)")
                    return True, None  # Возвращаем success, так как цель достигнута (сообщения нет)
                logger.warning(f"Failed to delete message {message_id} from chat_id {chat_id}: {error_msg}")
            except:
                error_msg = f"HTTP {response.status_code} - {response.text}"
                logger.warning(f"Failed to delete message {message_id} from chat_id {chat_id}: {error_msg}")
            return False, error_msg
    except Exception as e:
        logger.error(f"Exception while deleting Telegram message: {e}")
        return False, str(e)

def normalize_chat_id(chat_id):
    """Нормализует chat_id для Telegram API (только числовые ID)"""
    if not chat_id:
        return chat_id
    
    chat_id_str = str(chat_id).strip()
    
    # Проверяем, что это числовой ID (начинается с минуса или только цифры)
    if not (chat_id_str.startswith('-') or chat_id_str.lstrip('-').isdigit()):
        # Это не числовой ID - возвращаем None или пустую строку
        return None
    
    # Это числовой ID - возвращаем как есть
    return chat_id_str

def send_telegram_message(bot_token, chat_id, message, reply_markup=None):
    """Отправить сообщение в Telegram. Возвращает (success: bool, message_id: int или None, error: str или None)"""
    try:
        # Нормализуем chat_id (только числовые ID)
        normalized_chat_id = normalize_chat_id(chat_id)
        if not normalized_chat_id:
            error_msg = f"Некорректный chat_id: {chat_id}. Поддерживаются только числовые ID"
            logger.error(error_msg)
            return False, None, error_msg
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        params = {
            'chat_id': normalized_chat_id,  # Используем нормализованный числовой chat_id
            'text': message,
            'parse_mode': 'Markdown',
            'disable_web_page_preview': True
        }
        if reply_markup:
            params['reply_markup'] = reply_markup
        
        logger.debug(f"Sending Telegram message to chat_id={normalized_chat_id} (original: {chat_id}, type: {type(chat_id)}), URL: {url}")
        response = requests.post(url, json=params, timeout=10)
        
        if response.ok:
            result = response.json()
            if result.get('ok'):
                message_id = result.get('result', {}).get('message_id')
                logger.debug(f"Telegram API response OK for chat_id {normalized_chat_id}, message_id: {message_id}")
                return True, message_id, None
            else:
                error_desc = result.get('description', 'Unknown error')
                error_code = result.get('error_code', 'N/A')
                # Проверяем, есть ли новый chat ID для мигрированной группы
                migrate_to_chat_id = result.get('parameters', {}).get('migrate_to_chat_id')
                if migrate_to_chat_id:
                    error_msg = f"[{error_code}] {error_desc}. Новый chat ID: {migrate_to_chat_id}"
                    logger.warning(f"Group migrated to supergroup. Old chat_id: {normalized_chat_id}, New chat_id: {migrate_to_chat_id}")
                else:
                    error_msg = f"[{error_code}] {error_desc}"
                    logger.error(f"Telegram API returned ok=false for chat_id {normalized_chat_id}: {error_msg}")
                return False, None, error_msg
        else:
            try:
                error_data = response.json()
                error_desc = error_data.get('description', response.text)
                error_code = error_data.get('error_code', response.status_code)
                # Проверяем, есть ли новый chat ID для мигрированной группы
                migrate_to_chat_id = error_data.get('parameters', {}).get('migrate_to_chat_id')
                if migrate_to_chat_id:
                    error_msg = f"HTTP {response.status_code}, [{error_code}] {error_desc}. Новый chat ID: {migrate_to_chat_id}"
                    logger.warning(f"Group migrated to supergroup. Old chat_id: {normalized_chat_id}, New chat_id: {migrate_to_chat_id}")
                else:
                    error_msg = f"HTTP {response.status_code}, [{error_code}] {error_desc}"
                    logger.error(f"Telegram API HTTP error for chat_id {normalized_chat_id}: {error_msg}")
            except:
                error_msg = f"HTTP {response.status_code} - {response.text}"
                logger.error(f"Telegram API HTTP error for chat_id {chat_id}: {error_msg}")
            return False, None, error_msg
    except requests.exceptions.Timeout:
        error_msg = "Timeout при отправке сообщения"
        logger.error(f"Timeout sending Telegram message to {chat_id}")
        return False, error_msg
    except requests.exceptions.RequestException as e:
        error_msg = f"Ошибка сети: {str(e)}"
        logger.error(f"Request exception sending Telegram message to {chat_id}: {e}")
        return False, error_msg
    except Exception as e:
        error_msg = f"Неожиданная ошибка: {str(e)}"
        logger.error(f"Exception sending Telegram message to {chat_id}: {e}", exc_info=True)
        return False, error_msg

def get_bazars_keyboard():
    """Создать клавиатуру со списком базаров"""
    try:
        services = BazarStatus.query.all()
        keyboard = []
        
        # Группируем по 2 кнопки в ряд
        for i in range(0, len(services), 2):
            row = []
            for j in range(2):
                if i + j < len(services):
                    service = services[i + j]
                    status_emoji = "🟢" if service.status == 'online' else "🔴"
                    row.append({
                        'text': f"{status_emoji} {service.bazar_name}",
                        'callback_data': f"bazar_{service.id}"
                    })
            keyboard.append(row)
        
        # Добавляем кнопку "Обновить"
        keyboard.append([{'text': '🔄 Обновить список', 'callback_data': 'refresh_bazars'}])
        
        return {'inline_keyboard': keyboard}
    except Exception as e:
        app.logger.error(f"Error creating bazars keyboard: {e}", exc_info=True)
        return {'inline_keyboard': []}

def format_bazar_info(service, camera_stats=None):
    """Форматировать информацию о базаре для Telegram"""
    status_emoji = "🟢" if service.status == 'online' else "🔴"
    status_text = "Онлайн" if service.status == 'online' else "Офлайн"
    
    message = f"{status_emoji} *{service.bazar_name}*\n"
    message += f"━━━━━━━━━━━━━━━━━━━━\n\n"
    
    if service.city:
        message += f"📍 *Город:* {service.city}\n"
    
    message += f"📊 *Статус:* {status_text}\n"
    
    if camera_stats:
        total = camera_stats.get('totalCameras', 0)
        online = camera_stats.get('onlineCameras', 0)
        offline = camera_stats.get('offlineCameras', 0)
        
        message += f"\n📹 *Камеры:*\n"
        message += f"   • Всего: {total}\n"
        message += f"   • 🟢 Онлайн: {online}\n"
        message += f"   • 🔴 Офлайн: {offline}\n"
    
    if service.contact_click or service.contact_click_name:
        message += f"\n📞 *Контакты Click:*\n"
        if service.contact_click_name:
            message += f"   • {service.contact_click_name}\n"
        if service.contact_click:
            message += f"   • {service.contact_click}\n"
    
    if service.contact_scc or service.contact_scc_name:
        message += f"\n📞 *Контакты SCC:*\n"
        if service.contact_scc_name:
            message += f"   • {service.contact_scc_name}\n"
        if service.contact_scc:
            message += f"   • {service.contact_scc}\n"
    
    if service.last_check:
        message += f"\n🕐 *Последняя проверка:*\n"
        message += f"   {service.last_check.strftime('%Y-%m-%d %H:%M:%S')}\n"
    
    # Кнопка "Назад к списку"
    keyboard = {
        'inline_keyboard': [
            [{'text': '🔙 Назад к списку', 'callback_data': 'list_bazars'}],
            [{'text': '🔄 Обновить', 'callback_data': f'bazar_{service.id}'}]
        ]
    }
    
    return message, keyboard

def normalize_region_name(region_name):
    """Нормализует название региона для сравнения (приводит разные форматы к одному виду)"""
    if not region_name:
        return None
    
    region_lower = region_name.lower().strip()
    
    # Маппинг различных вариантов названий к нормализованным
    region_mapping = {
        # Ташкент город
        'toshkent shahri': 'toshkentshahri',
        'toshkentshahri': 'toshkentshahri',
        'г. ташкент': 'toshkentshahri',
        'г.ташкент': 'toshkentshahri',
        'ташкент': 'toshkentshahri',
        'toshkent': 'toshkentshahri',
        # Ташкент область
        'toshkent viloyati': 'toshkentviloyati',
        'toshkentviloyati': 'toshkentviloyati',
        'ташкентская область': 'toshkentviloyati',
        'ташкент вилояти': 'toshkentviloyati',
        # Другие регионы (можно расширить)
        'fargona': 'fargona',
        "farg'ona": 'fargona',
        'farg`ona': 'fargona',
        'fergana': 'fargona',
        'фергана': 'fargona',
        'namangan': 'namangan',
        'наманган': 'namangan',
        'sirdaryo': 'sirdaryo',
        'сырдарья': 'sirdaryo',
        'surxondaryo': 'surxondaryo',
        'сурхандарья': 'surxondaryo',
    }
    
    # Убираем апострофы и другие спецсимволы для нормализации
    region_lower_clean = region_lower.replace("'", "").replace("`", "").replace("'", "").replace("'", "")
    
    # Проверяем точное совпадение (сначала оригинальный, потом очищенный)
    if region_lower in region_mapping:
        return region_mapping[region_lower]
    if region_lower_clean in region_mapping:
        return region_mapping[region_lower_clean]
    
    # Проверяем частичное совпадение (например, "Toshkent shahri" содержит "toshkent")
    for key, normalized in region_mapping.items():
        key_clean = key.replace("'", "").replace("`", "").replace("'", "").replace("'", "")
        if key in region_lower or region_lower in key or key_clean in region_lower_clean or region_lower_clean in key_clean:
            return normalized
    
    # Если не нашли, возвращаем нормализованную версию (убираем пробелы, спецсимволы, апострофы)
    normalized = region_lower_clean.replace(' ', '').replace('.', '').replace('г', '').replace('область', 'viloyati').replace('вилояти', 'viloyati')
    return normalized

def send_telegram_notification(bazar_name, city, offline_cameras_count, total_cameras, notification_type='offline', service=None, next_notification_in=None):
    """Отправить уведомление в Telegram о изменении статуса камер (во все настроенные chat ID с учетом фильтрации по областям)"""
    try:
        # Используем статичный bot token
        bot_token = TELEGRAM_BOT_TOKEN
        
        # Если статичный токен не задан, пытаемся получить из БД
        if not bot_token:
            telegram_settings = TelegramSettings.query.filter_by(enabled=True).first()
            if not telegram_settings or not telegram_settings.bot_token:
                app.logger.error("ERROR: Telegram bot token not configured")
                return False
            bot_token = telegram_settings.bot_token
        
        if not bot_token:
            app.logger.error("ERROR: Telegram bot token not configured")
            return False
        
        # Получаем область базара для фильтрации
        bazar_region = None
        if service and service.city:
            # Определяем область по городу
            bazar_region = service.city
        
        # Нормализуем название региона базара
        bazar_region_normalized = normalize_region_name(bazar_region) if bazar_region else None
        
        app.logger.info(f"DEBUG: Sending notification for bazar '{bazar_name}' in region '{bazar_region}' (normalized: '{bazar_region_normalized}')")
        
        # Получаем список всех активных chat ID из БД с проверкой фильтрации по областям
        chat_ids_dict = {}  # Используем словарь для дедупликации по chat_id
        telegram_chats = TelegramChatId.query.filter_by(enabled=True).all()
        app.logger.info(f"DEBUG: Found {len(telegram_chats)} enabled chat IDs in database")
        
        for chat in telegram_chats:
            # Проверяем фильтрацию по областям
            allowed_regions = chat.get_allowed_regions()
            app.logger.info(f"DEBUG: Chat ID {chat.chat_id} (type: {chat.chat_type}) - allowed_regions: {allowed_regions}, bazar_region: {bazar_region}")
            
            should_add = False
            if allowed_regions is None:
                # Если None - разрешены все области
                app.logger.info(f"DEBUG: Chat ID {chat.chat_id} - разрешены все области, добавляем")
                should_add = True
            elif bazar_region_normalized:
                # Нормализуем все разрешенные регионы и сравниваем
                allowed_regions_normalized = [normalize_region_name(r) for r in allowed_regions if r]
                if bazar_region_normalized in allowed_regions_normalized:
                    app.logger.info(f"DEBUG: Chat ID {chat.chat_id} - область '{bazar_region}' (normalized: '{bazar_region_normalized}') в списке разрешенных, добавляем")
                    should_add = True
                else:
                    app.logger.info(f"DEBUG: Chat ID {chat.chat_id} - область '{bazar_region}' (normalized: '{bazar_region_normalized}') НЕ в списке разрешенных {allowed_regions_normalized}, пропускаем")
            elif not bazar_region:
                # Если область не указана, отправляем всем
                app.logger.info(f"DEBUG: Chat ID {chat.chat_id} - область не указана, добавляем")
                should_add = True
            else:
                app.logger.info(f"DEBUG: Chat ID {chat.chat_id} - область '{bazar_region}' НЕ в списке разрешенных, пропускаем")
            
            # Добавляем в словарь для дедупликации (если chat_id уже есть, перезаписываем)
            if should_add:
                chat_ids_dict[str(chat.chat_id)] = (chat.chat_id, chat)
        
        # Преобразуем словарь в список
        chat_ids = list(chat_ids_dict.values())
        
        if not chat_ids:
            app.logger.error(f"ERROR: No Telegram chat IDs configured or no matching regions for bazar '{bazar_name}' in region '{bazar_region}'")
            app.logger.error(f"ERROR: Total enabled chats: {len(telegram_chats)}")
            return False
        
        app.logger.info(f"DEBUG: Will send notification to {len(chat_ids)} unique chat ID(s)")
        
        # Формируем сообщение в зависимости от типа уведомления
        if notification_type == 'offline':
            # Уведомление о том, что камеры ушли в офлайн
            message = f"⚠️ *Камеры отключены*\n\n"
            message += f"🏪 *Базар:* {bazar_name}\n"
            if city:
                message += f"📍 *Город:* {city}\n"
            message += f"📹 *Неработающих камер:* {offline_cameras_count} из {total_cameras}\n"
            message += f"🕐 *Время:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"
            
            # Добавляем информацию о времени до следующего уведомления
            if next_notification_in is not None:
                hours = int(next_notification_in // 3600)
                minutes = int((next_notification_in % 3600) // 60)
                if hours > 0:
                    time_str = f"{hours} ч. {minutes} мин."
                else:
                    time_str = f"{minutes} мин."
                message += f"\n⏰ *Следующее уведомление через:* {time_str}"
        else:
            # Уведомление о том, что все камеры вернулись в онлайн
            message = f"✅ *Все камеры активны*\n\n"
            message += f"🏪 *Базар:* {bazar_name}\n"
            if city:
                message += f"📍 *Город:* {city}\n"
            message += f"📹 *Всего камер:* {total_cameras}\n"
            message += f"🕐 *Время:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"
            message += "\n⏰ *Повторное уведомление будет только при изменении статуса камер*"
        
        # Отправляем уведомление во все настроенные chat ID (уже дедуплицированные)
        success_count = 0
        failed_chats = []
        for chat_id_tuple in chat_ids:
            chat_id = chat_id_tuple[0] if isinstance(chat_id_tuple, tuple) else chat_id_tuple
            chat_obj = chat_id_tuple[1] if isinstance(chat_id_tuple, tuple) and len(chat_id_tuple) > 1 else None
            chat_type = chat_obj.chat_type if chat_obj else 'unknown'
            
            # Пропускаем некорректные chat_id (только числовые ID поддерживаются)
            if not normalize_chat_id(chat_id):
                app.logger.debug(f"Skipping notification to invalid chat_id {chat_id} - only numeric IDs are supported")
                continue
            
            # Удаляем предыдущее сообщение, если оно есть
            if chat_obj and chat_obj.last_message_id:
                try:
                    delete_success, delete_error = delete_telegram_message(bot_token, chat_id, chat_obj.last_message_id)
                    if delete_success:
                        app.logger.debug(f"Deleted previous message {chat_obj.last_message_id} from chat_id {chat_id}")
                    else:
                        app.logger.debug(f"Could not delete previous message {chat_obj.last_message_id} from chat_id {chat_id}: {delete_error}")
                except Exception as e:
                    app.logger.warning(f"Error deleting previous message from chat_id {chat_id}: {e}")
            
            # Отправляем новое сообщение
            success, message_id, error_detail = send_telegram_message(bot_token, chat_id, message)
            if success and message_id:
                success_count += 1
                # Сохраняем ID нового сообщения в базу данных
                if chat_obj:
                    try:
                        chat_obj.last_message_id = message_id
                        db.session.commit()
                        app.logger.debug(f"Saved message_id {message_id} for chat_id {chat_id}")
                    except Exception as e:
                        app.logger.warning(f"Error saving message_id for chat_id {chat_id}: {e}")
                app.logger.info(f"Successfully sent notification to chat_id {chat_id} (type: {chat_type}), message_id: {message_id}")
            else:
                failed_chats.append((chat_id, chat_type, error_detail))
                app.logger.warning(f"Failed to send notification to chat_id {chat_id} (type: {chat_type}): {error_detail}")
                # Если это пользователь и ошибка о том, что бот не может инициировать диалог
                if chat_type == 'user' and error_detail and ('can\'t initiate conversation' in error_detail.lower() or 'forbidden' in error_detail.lower() or 'chat not found' in error_detail.lower()):
                    app.logger.warning(f"User {chat_id} needs to start the bot first by sending /start command")
        
        if failed_chats:
            app.logger.warning(f"Failed to send notifications to {len(failed_chats)} chat(s): {failed_chats}")
        
        return success_count > 0
        
    except Exception as e:
        app.logger.error(f"Error sending Telegram notification: {e}", exc_info=True)
        return False

def send_current_status_to_chat_id(chat_id_obj):
    """Отправить текущее состояние всех базаров с включенными уведомлениями в указанный chat ID"""
    try:
        app.logger.info(f"Sending current status to new chat ID: {chat_id_obj.chat_id} (type: {chat_id_obj.chat_type})")
        
        # Проверяем, что это числовой ID
        if not normalize_chat_id(chat_id_obj.chat_id):
            app.logger.warning(f"Skipping send_current_status for invalid chat_id {chat_id_obj.chat_id} - only numeric IDs are supported")
            return
        
        # Получаем все сервисы с включенными уведомлениями
        services = BazarStatus.query.filter_by(telegram_notifications_enabled=True).all()
        
        if not services:
            app.logger.info("No services with enabled notifications found")
            return
        
        # Используем статичный bot token
        bot_token = TELEGRAM_BOT_TOKEN
        if not bot_token:
            telegram_settings = TelegramSettings.query.filter_by(enabled=True).first()
            if not telegram_settings or not telegram_settings.bot_token:
                app.logger.error("ERROR: Telegram bot token not configured")
                return
            bot_token = telegram_settings.bot_token
        
        if not bot_token:
            app.logger.error("ERROR: Telegram bot token not configured")
            return
        
        sent_count = 0
        skipped_count = 0
        
        for service in services:
            try:
                # Проверяем фильтрацию по областям
                bazar_region = service.city if service.city else None
                bazar_region_normalized = normalize_region_name(bazar_region) if bazar_region else None
                
                allowed_regions = chat_id_obj.get_allowed_regions()
                
                # Проверяем, нужно ли отправлять уведомление для этого базара
                should_send = False
                if allowed_regions is None:
                    # Если None - разрешены все области
                    should_send = True
                elif bazar_region_normalized:
                    # Нормализуем все разрешенные регионы и сравниваем
                    allowed_regions_normalized = [normalize_region_name(r) for r in allowed_regions if r]
                    if bazar_region_normalized in allowed_regions_normalized:
                        should_send = True
                elif not bazar_region:
                    # Если область не указана, отправляем
                    should_send = True
                
                if not should_send:
                    app.logger.debug(f"Skipping {service.bazar_name} - region '{bazar_region}' not in allowed regions for chat {chat_id_obj.chat_id}")
                    skipped_count += 1
                    continue
                
                # Получаем текущую статистику камер
                endpoint = {
                    'ip': service.bazar_ip,
                    'port': service.bazar_port,
                    'backendPort': service.backend_port,
                    'pgPort': service.pg_port
                }
                
                result = fetch_bazar_info(endpoint)
                
                if result['success']:
                    camera_stats = result['data'] if isinstance(result['data'], dict) else {}
                    offline_cameras = camera_stats.get('offlineCameras', 0)
                    total_cameras = camera_stats.get('totalCameras', 0)
                    online_cameras = camera_stats.get('onlineCameras', 0)
                    
                    if total_cameras > 0:
                        # Определяем тип уведомления
                        notification_type = 'offline' if offline_cameras > 0 else 'online'
                        
                        # Вычисляем время до следующего уведомления (только для офлайн)
                        next_notification_in = None
                        if notification_type == 'offline':
                            check_interval = service.notification_check_interval or 3600
                            next_notification_in = check_interval
                        
                        # Удаляем предыдущее сообщение для этого базара, если оно есть
                        # Для send_current_status_to_chat_id мы отправляем несколько сообщений (по одному на базар),
                        # поэтому удаляем только если это первое сообщение в серии
                        if sent_count == 0 and chat_id_obj.last_message_id:
                            try:
                                delete_success, delete_error = delete_telegram_message(bot_token, chat_id_obj.chat_id, chat_id_obj.last_message_id)
                                if delete_success:
                                    app.logger.debug(f"Deleted previous message {chat_id_obj.last_message_id} from chat_id {chat_id_obj.chat_id}")
                            except Exception as e:
                                app.logger.debug(f"Error deleting previous message from chat_id {chat_id_obj.chat_id}: {e}")
                        
                        # Отправляем уведомление напрямую в указанный chat ID
                        success, message_id, error_detail = send_telegram_message(
                            bot_token,
                            chat_id_obj.chat_id,
                            _format_notification_message(
                                service.bazar_name,
                                service.city,
                                offline_cameras,
                                total_cameras,
                                notification_type,
                                next_notification_in
                            )
                        )
                        
                        if success and message_id:
                            sent_count += 1
                            # Сохраняем ID последнего сообщения (сохраняем только для последнего отправленного)
                            if sent_count == 1:  # Сохраняем только для первого сообщения в серии
                                try:
                                    chat_id_obj.last_message_id = message_id
                                    db.session.commit()
                                except Exception as e:
                                    app.logger.warning(f"Error saving message_id for chat_id {chat_id_obj.chat_id}: {e}")
                            app.logger.info(f"Sent current status for {service.bazar_name} to chat {chat_id_obj.chat_id}, message_id: {message_id}")
                        else:
                            app.logger.warning(f"Failed to send status for {service.bazar_name} to chat {chat_id_obj.chat_id}: {error_detail}")
                    else:
                        app.logger.debug(f"Skipping {service.bazar_name} - no cameras found")
                else:
                    app.logger.warning(f"Failed to fetch camera stats for {service.bazar_name}: {result.get('error', 'Unknown error')}")
                    
            except Exception as e:
                app.logger.error(f"Error sending status for {service.bazar_name} to chat {chat_id_obj.chat_id}: {e}", exc_info=True)
        
        app.logger.info(f"Sent current status to chat {chat_id_obj.chat_id}: {sent_count} sent, {skipped_count} skipped")
        
    except Exception as e:
        app.logger.error(f"Error sending current status to chat ID: {e}", exc_info=True)

def _escape_markdown(text):
    """Экранирует специальные символы Markdown для Telegram"""
    if not text:
        return text
    # Экранируем специальные символы Markdown: _ * [ ] ( ) ~ ` > # + - = | { } . !
    special_chars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']
    escaped = str(text)
    for char in special_chars:
        escaped = escaped.replace(char, '\\' + char)
    return escaped

def _format_notification_message(bazar_name, city, offline_cameras_count, total_cameras, notification_type='offline', next_notification_in=None):
    """Форматирует сообщение уведомления"""
    # Экранируем специальные символы Markdown в названиях
    safe_bazar_name = _escape_markdown(bazar_name)
    safe_city = _escape_markdown(city) if city else None
    
    if notification_type == 'offline':
        message = f"⚠️ *Камеры отключены*\n\n"
        message += f"🏪 *Базар:* {safe_bazar_name}\n"
        if safe_city:
            message += f"📍 *Город:* {safe_city}\n"
        message += f"📹 *Неработающих камер:* {offline_cameras_count} из {total_cameras}\n"
        message += f"🕐 *Время:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"
        
        if next_notification_in is not None:
            hours = int(next_notification_in // 3600)
            minutes = int((next_notification_in % 3600) // 60)
            if hours > 0:
                time_str = f"{hours} ч. {minutes} мин."
            else:
                time_str = f"{minutes} мин."
            message += f"\n⏰ *Следующее уведомление через:* {time_str}"
    else:
        message = f"✅ *Все камеры активны*\n\n"
        message += f"🏪 *Базар:* {safe_bazar_name}\n"
        if safe_city:
            message += f"📍 *Город:* {safe_city}\n"
        message += f"📹 *Всего камер:* {total_cameras}\n"
        message += f"🕐 *Время:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"
        message += "\n⏰ *Повторное уведомление будет только при изменении статуса камер*"
    
    return message

def check_and_notify_camera_changes(service, camera_stats):
    """Проверить изменения статуса камер (онлайн/офлайн) и отправить уведомление при переходе"""
    try:
        # Проверяем, включены ли уведомления для этого базара
        if not service.telegram_notifications_enabled:
            return
        
        # Получаем текущее состояние камер
        offline_cameras = camera_stats.get('offlineCameras', 0)
        total_cameras = camera_stats.get('totalCameras', 0)
        online_cameras = camera_stats.get('onlineCameras', 0)
        
        # Определяем текущий статус: все камеры онлайн или есть офлайн
        all_cameras_online = (offline_cameras == 0 and total_cameras > 0)
        has_offline_cameras = (offline_cameras > 0)
        
        # Определяем предыдущий статус (используем last_offline_cameras_count как флаг)
        # Если last_offline_cameras_count == 0, значит все камеры были онлайн
        # Если last_offline_cameras_count > 0, значит были офлайн камеры
        previous_all_online = (service.last_offline_cameras_count == 0)
        previous_has_offline = (service.last_offline_cameras_count > 0)
        
        # Проверяем переходы статуса
        should_notify = False
        notification_type = None
        
        # Переход: все онлайн → появились офлайн камеры
        if previous_all_online and has_offline_cameras:
            should_notify = True
            notification_type = 'offline'
        
        # Переход: были офлайн камеры → все камеры онлайн
        elif previous_has_offline and all_cameras_online:
            should_notify = True
            notification_type = 'online'
        
        if should_notify:
            # Отправляем уведомление
            # Вычисляем время до следующего уведомления (только для офлайн уведомлений)
            next_notification_in = None
            if notification_type == 'offline':
                check_interval = service.notification_check_interval or 3600
                next_notification_in = check_interval
            
            success = send_telegram_notification(
                service.bazar_name,
                service.city,
                offline_cameras,
                total_cameras,
                notification_type,
                service=service,
                next_notification_in=next_notification_in
            )
            
            if success:
                # Обновляем счетчик (0 если все онлайн, >0 если есть офлайн)
                service.last_offline_cameras_count = offline_cameras
                service.last_notification_time = datetime.utcnow()
                db.session.commit()
        else:
            # Если камеры постоянно офлайн, отправляем периодические напоминания
            # Используем настраиваемый интервал проверки для каждого базара
            check_interval = service.notification_check_interval or 3600  # По умолчанию 1 час
            if has_offline_cameras and service.last_notification_time:
                time_diff = (datetime.utcnow() - service.last_notification_time).total_seconds()
                # Отправляем напоминание если прошло больше заданного интервала
                if time_diff >= check_interval:
                    # Вычисляем время до следующего уведомления
                    next_notification_in = check_interval
                    
                    success = send_telegram_notification(
                        service.bazar_name,
                        service.city,
                        offline_cameras,
                        total_cameras,
                        'offline',
                        service=service,
                        next_notification_in=next_notification_in
                    )
                    if success:
                        service.last_notification_time = datetime.utcnow()
                        db.session.commit()
            
            # Обновляем счетчик без отправки уведомления
            service.last_offline_cameras_count = offline_cameras
            db.session.commit()
                        
    except Exception as e:
        app.logger.error(f"Error checking camera changes: {e}", exc_info=True)

def background_check_cameras():
    """Фоновая задача для периодической проверки статуса камер и отправки уведомлений"""
    with app.app_context():
        try:
            app.logger.info("=== Background camera check started ===")
            
            # Получаем все сервисы с включенными уведомлениями
            services = BazarStatus.query.filter_by(telegram_notifications_enabled=True).all()
            
            if not services:
                app.logger.debug("No services with enabled notifications found")
                return
            
            app.logger.info(f"Checking {len(services)} service(s) with enabled notifications")
            
            for service in services:
                try:
                    # Формируем endpoint для проверки
                    endpoint = {
                        'ip': service.bazar_ip,
                        'port': service.bazar_port,
                        'backendPort': service.backend_port,
                        'pgPort': service.pg_port
                    }
                    
                    # Получаем статистику камер
                    result = fetch_bazar_info(endpoint)
                    
                    if result['success']:
                        camera_stats = result['data'] if isinstance(result['data'], dict) else {}
                        # Проверяем изменения и отправляем уведомления
                        check_and_notify_camera_changes(service, camera_stats)
                        app.logger.debug(f"Checked cameras for {service.bazar_name}: {camera_stats.get('onlineCameras', 0)} online, {camera_stats.get('offlineCameras', 0)} offline")
                    else:
                        app.logger.warning(f"Failed to fetch camera stats for {service.bazar_name}: {result.get('error', 'Unknown error')}")
                        
                except Exception as e:
                    app.logger.error(f"Error checking cameras for {service.bazar_name}: {e}", exc_info=True)
            
            app.logger.info("=== Background camera check completed ===")
            
        except Exception as e:
            app.logger.error(f"Error in background camera check: {e}", exc_info=True)

def start_background_scheduler():
    """Запустить фоновый планировщик для проверки камер"""
    def run_periodic_check():
        """Запускает проверку каждые 5 минут"""
        while True:
            try:
                background_check_cameras()
            except Exception as e:
                app.logger.error(f"Error in periodic check: {e}", exc_info=True)
            
            # Ждем 5 минут (300 секунд) до следующей проверки
            time.sleep(300)
    
    # Запускаем в отдельном потоке
    scheduler_thread = threading.Thread(target=run_periodic_check, daemon=True)
    scheduler_thread.start()
    app.logger.info("Background camera scheduler started (checking every 5 minutes)")

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
        # Используем название из БД (если есть), а не из API сервиса
        bazar_name = current_bazar.bazar_name if current_bazar else f"{endpoint['ip']}:{endpoint['port']}"
        city = current_bazar.city if current_bazar else 'Unknown'
        
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
            # НЕ обновляем название и город - они управляются только через форму редактирования
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
    def get(self):
        """Получить статус всех базаров (проверяет напрямую и логирует изменения)"""
        try:
            app.logger.info("=== /api/bazars endpoint called ===")
            results = []
            
            # Получаем все сервисы из БД
            try:
                app.logger.info("Querying database for services...")
                services = BazarStatus.query.all()
                app.logger.info(f"Found {len(services)} services in database")
            except Exception as db_error:
                app.logger.error(f"Database error: {db_error}", exc_info=True)
                return {
                    'success': False,
                    'error': f'Database error: {str(db_error)}',
                    'data': [],
                    'total': 0,
                    'online': 0,
                    'offline': 0
                }, 500
            
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
                
                try:
                    result = fetch_bazar_info(endpoint)
                    
                    if result['success']:
                        data = result['data']
                        log_status_change(data, endpoint, 'online')
                        
                        # Проверяем изменения камер и отправляем уведомления если нужно
                        try:
                            # Получаем статистику камер из ответа
                            camera_stats = data if isinstance(data, dict) else {}
                            check_and_notify_camera_changes(service, camera_stats)
                        except Exception as e:
                            app.logger.error(f"Error checking camera changes for {service.bazar_name}: {e}", exc_info=True)
                        
                        results.append({
                            'id': service.id,
                            'name': service.bazar_name,  # Всегда берем из БД, а не из API сервиса
                            'city': service.city,  # Всегда берем из БД, а не из API сервиса
                            'status': 'online',
                            'endpoint': endpoint,
                            'contact_click': service.contact_click,
                            'contact_click_name': service.contact_click_name,
                            'contact_scc': service.contact_scc,
                            'contact_scc_name': service.contact_scc_name,
                            'latitude': service.latitude,
                            'longitude': service.longitude,
                            'telegram_notifications_enabled': service.telegram_notifications_enabled or False,
                            'timestamp': datetime.utcnow().isoformat()
                        })
                    else:
                        log_status_change(None, endpoint, 'offline', result.get('error'))
                        results.append({
                            'id': service.id,
                            'name': service.bazar_name,
                            'city': service.city,
                            'status': 'offline',
                            'error': result.get('error'),
                            'endpoint': endpoint,
                            'contact_click': service.contact_click,
                            'contact_click_name': service.contact_click_name,
                            'contact_scc': service.contact_scc,
                            'contact_scc_name': service.contact_scc_name,
                            'latitude': service.latitude,
                            'longitude': service.longitude,
                            'telegram_notifications_enabled': service.telegram_notifications_enabled or False,
                            'timestamp': datetime.utcnow().isoformat()
                        })
                except Exception as e:
                    app.logger.error(f"Error processing service {service.bazar_name}: {e}", exc_info=True)
                    # В случае ошибки добавляем базар как офлайн
                    results.append({
                        'id': service.id,
                        'name': service.bazar_name,
                        'city': service.city,
                        'status': 'offline',
                        'error': str(e),
                        'endpoint': endpoint,
                        'contact_click': service.contact_click,
                        'contact_click_name': service.contact_click_name,
                        'contact_scc': service.contact_scc,
                        'contact_scc_name': service.contact_scc_name,
                        'latitude': service.latitude,
                        'longitude': service.longitude,
                        'telegram_notifications_enabled': service.telegram_notifications_enabled or False,
                        'timestamp': datetime.utcnow().isoformat()
                    })
            
            response_data = {
                'success': True,
                'data': results,
                'total': len(results),
                'online': len([r for r in results if r['status'] == 'online']),
                'offline': len([r for r in results if r['status'] == 'offline'])
            }
            app.logger.info(f"Returning response with {len(results)} results")
            return response_data
        except Exception as e:
            app.logger.error(f"Error in /api/bazars: {e}", exc_info=True)
            import traceback
            traceback.print_exc()
            # Возвращаем словарь - Flask-RESTX автоматически сериализует его
            return {
                'success': False,
                'error': str(e),
                'data': [],
                'total': 0,
                'online': 0,
                'offline': 0
            }, 500
    

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

@app.route('/api/cameras/statistics', methods=['GET'])
def get_cameras_statistics():
    """Получить общую статистику по камерам всех базаров"""
    try:
        # Получаем все сервисы из БД
        services = BazarStatus.query.all()
        
        # Инициализируем счетчики
        total_cameras = 0
        online_cameras = 0
        offline_cameras = 0
        rasta_food_cameras = 0
        people_counting_cameras = 0
        animal_cameras = 0
        vehicle_counting_cameras = 0
        accessible_bazars = 0
        
        # Словарь для группировки по областям
        regions_stats = {}
        
        # Собираем статистику по каждому базару
        for service in services:
            try:
                # Проверяем доступность API камер
                camera_api_url = f"http://{service.bazar_ip}:{service.backend_port}/api/cameras/statistics"
                
                response = requests.get(camera_api_url, timeout=3)
                
                if response.ok:
                    stats = response.json()
                    total_cameras += stats.get('totalCameras', 0)
                    online_cameras += stats.get('onlineCameras', 0)
                    offline_cameras += stats.get('offlineCameras', 0)
                    rasta_food_cameras += stats.get('rastaFoodCameras', 0)
                    people_counting_cameras += stats.get('peopleCountingCameras', 0)
                    animal_cameras += stats.get('animalCameras', 0)
                    vehicle_counting_cameras += stats.get('vehicleCountingCameras', 0)
                    accessible_bazars += 1
                    
                    # Проверяем изменения камер и отправляем уведомления если нужно
                    check_and_notify_camera_changes(service, stats)
                    
                    # Группируем по областям
                    region = service.city or 'Unknown'
                    if region not in regions_stats:
                        regions_stats[region] = {
                            'totalBazars': 0,
                            'onlineBazars': 0,
                            'offlineBazars': 0,
                            'totalCameras': 0,
                            'onlineCameras': 0,
                            'offlineCameras': 0
                        }
                    
                    regions_stats[region]['totalBazars'] += 1
                    regions_stats[region]['onlineBazars'] += 1
                    regions_stats[region]['totalCameras'] += stats.get('totalCameras', 0)
                    regions_stats[region]['onlineCameras'] += stats.get('onlineCameras', 0)
                    regions_stats[region]['offlineCameras'] += stats.get('offlineCameras', 0)
                else:
                    # Базар оффлайн
                    region = service.city or 'Unknown'
                    if region not in regions_stats:
                        regions_stats[region] = {
                            'totalBazars': 0,
                            'onlineBazars': 0,
                            'offlineBazars': 0,
                            'totalCameras': 0,
                            'onlineCameras': 0,
                            'offlineCameras': 0
                        }
                    
                    regions_stats[region]['totalBazars'] += 1
                    regions_stats[region]['offlineBazars'] += 1
                    
            except Exception as e:
                app.logger.error(f"Ошибка получения статистики камер для {service.bazar_name}: {e}", exc_info=True)
                # Базар оффлайн
                region = service.city or 'Unknown'
                if region not in regions_stats:
                    regions_stats[region] = {
                        'totalBazars': 0,
                        'onlineBazars': 0,
                        'offlineBazars': 0,
                        'totalCameras': 0,
                        'onlineCameras': 0,
                        'offlineCameras': 0
                    }
                
                regions_stats[region]['totalBazars'] += 1
                regions_stats[region]['offlineBazars'] += 1
                continue
        
        return jsonify({
            'success': True,
            'data': {
                'totalCameras': total_cameras,
                'onlineCameras': online_cameras,
                'offlineCameras': offline_cameras,
                'rastaFoodCameras': rasta_food_cameras,
                'peopleCountingCameras': people_counting_cameras,
                'animalCameras': animal_cameras,
                'vehicleCountingCameras': vehicle_counting_cameras,
                'accessibleBazars': accessible_bazars,
                'totalBazars': len(services),
                'uptime_percentage': (online_cameras / total_cameras * 100) if total_cameras > 0 else 0,
                'regionsStats': regions_stats
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

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
                stream_port=data.get('stream_port'),
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
                'pg_port': service.pg_port,
                'stream_port': service.stream_port,
                'contact_click': service.contact_click,
                'contact_click_name': service.contact_click_name,
                'contact_scc': service.contact_scc,
                'contact_scc_name': service.contact_scc_name,
                'latitude': service.latitude,
                'longitude': service.longitude
            }
            
            # Обновляем поля
            changes = {}
            if 'name' in data and data['name'] != service.bazar_name:
                changes['name'] = {'old': service.bazar_name, 'new': data['name']}
                service.bazar_name = data['name']
            if 'city' in data and data['city'] != service.city:
                changes['city'] = {'old': service.city, 'new': data['city']}
                service.city = data['city']
            if 'ip' in data and data['ip'] != service.bazar_ip:
                changes['ip'] = {'old': service.bazar_ip, 'new': data['ip']}
                service.bazar_ip = data['ip']
            if 'port' in data and data['port'] != service.bazar_port:
                changes['port'] = {'old': service.bazar_port, 'new': data['port']}
                service.bazar_port = data['port']
            if 'backend_port' in data and data['backend_port'] != service.backend_port:
                changes['backend_port'] = {'old': service.backend_port, 'new': data['backend_port']}
                service.backend_port = data['backend_port']
            if 'pg_port' in data and data['pg_port'] != service.pg_port:
                changes['pg_port'] = {'old': service.pg_port, 'new': data['pg_port']}
                service.pg_port = data['pg_port']
            if 'stream_port' in data and data['stream_port'] != service.stream_port:
                changes['stream_port'] = {'old': service.stream_port, 'new': data['stream_port']}
                service.stream_port = data['stream_port']
            
            # Обновляем контакты
            if 'contact_click' in data:
                new_val = data['contact_click']
                if new_val != service.contact_click:
                    changes['contact_click'] = {'old': service.contact_click, 'new': new_val}
                    service.contact_click = new_val
            if 'contact_click_name' in data:
                new_val = data['contact_click_name']
                if new_val != service.contact_click_name:
                    changes['contact_click_name'] = {'old': service.contact_click_name, 'new': new_val}
                    service.contact_click_name = new_val
            if 'contact_scc' in data:
                new_val = data['contact_scc']
                if new_val != service.contact_scc:
                    changes['contact_scc'] = {'old': service.contact_scc, 'new': new_val}
                    service.contact_scc = new_val
            if 'contact_scc_name' in data:
                new_val = data['contact_scc_name']
                if new_val != service.contact_scc_name:
                    changes['contact_scc_name'] = {'old': service.contact_scc_name, 'new': new_val}
                    service.contact_scc_name = new_val
            
            # Обновляем координаты
            if 'latitude' in data:
                new_val = data['latitude']
                if new_val != service.latitude:
                    changes['latitude'] = {'old': service.latitude, 'new': new_val}
                    service.latitude = new_val
            if 'longitude' in data:
                new_val = data['longitude']
                if new_val != service.longitude:
                    changes['longitude'] = {'old': service.longitude, 'new': new_val}
                    service.longitude = new_val
            
            # Обновляем настройки Telegram уведомлений
            if 'telegram_notifications_enabled' in data:
                service.telegram_notifications_enabled = bool(data['telegram_notifications_enabled'])
            
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


@telegram_ns.route('/telegram/setup')
class TelegramSetupResource(Resource):
    @telegram_ns.doc('setup_telegram')
    @telegram_ns.expect(api.model('TelegramSetup', {
        'bot_token': fields.String(required=True, description='Токен Telegram бота'),
        'chat_id': fields.String(description='Chat ID для отправки уведомлений (опционально)')
    }))
    def post(self):
        """Настроить Telegram бота для уведомлений"""
        try:
            data = request.json
            bot_token = data.get('bot_token')
            chat_id = data.get('chat_id')
            
            if not bot_token:
                return {
                    'success': False,
                    'error': 'Токен бота обязателен'
                }, 400
            
            # Проверяем, есть ли уже настройки
            telegram_settings = TelegramSettings.query.first()
            
            if telegram_settings:
                # Обновляем существующие настройки
                telegram_settings.bot_token = bot_token
                if chat_id:
                    telegram_settings.chat_id = chat_id
                telegram_settings.enabled = True
                telegram_settings.updated_at = datetime.utcnow()
            else:
                # Создаем новые настройки
                telegram_settings = TelegramSettings(
                    bot_token=bot_token,
                    chat_id=chat_id,
                    enabled=True
                )
                db.session.add(telegram_settings)
            
            db.session.commit()
            
            return {
                'success': True,
                'message': 'Настройки Telegram бота сохранены',
                'data': telegram_settings.to_dict()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500

    @telegram_ns.doc('get_telegram_settings')
    def get(self):
        """Получить настройки Telegram бота"""
        try:
            telegram_settings = TelegramSettings.query.first()
            
            if not telegram_settings:
                return {
                    'success': True,
                    'data': None,
                    'message': 'Настройки Telegram не найдены'
                }
            
            return {
                'success': True,
                'data': telegram_settings.to_dict()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500

@telegram_ns.route('/telegram/chat-ids')
class TelegramChatIdsResource(Resource):
    @telegram_ns.doc('get_telegram_chat_ids')
    def get(self):
        """Получить список всех chat ID для уведомлений"""
        try:
            chat_ids = TelegramChatId.query.order_by(TelegramChatId.created_at.desc()).all()
            return {
                'success': True,
                'data': [chat.to_dict() for chat in chat_ids]
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500
    
    @telegram_ns.doc('add_telegram_chat_id')
    @telegram_ns.expect(api.model('TelegramChatId', {
        'chat_id': fields.String(required=True, description='Chat ID (только числовой ID, например: -1001234567890 или 123456789)'),
        'chat_type': fields.String(enum=['channel', 'group', 'user'], description='Тип чата', default='channel'),
        'description': fields.String(description='Описание (например, "Основной канал")'),
        'allowed_regions': fields.List(fields.String(), description='Список разрешенных областей (если пусто - все области)')
    }))
    def post(self):
        """Добавить новый chat ID для уведомлений"""
        try:
            data = request.json
            chat_id = data.get('chat_id')
            chat_type = data.get('chat_type', 'channel')
            description = data.get('description', '')
            allowed_regions = data.get('allowed_regions', [])
            
            if not chat_id:
                return {
                    'success': False,
                    'error': 'Chat ID обязателен'
                }, 400
            
            # Проверяем, что это числовой ID (не username)
            chat_id_str = str(chat_id).strip()
            if chat_id_str.startswith('@') or not (chat_id_str.startswith('-') or chat_id_str.lstrip('-').isdigit()):
                return {
                    'success': False,
                    'error': 'Поддерживаются только числовые Chat ID. Username не поддерживаются. Получите числовой Chat ID через бота или используйте @userinfobot в Telegram'
                }, 400
            
            # Нормализуем chat_id (только числовые ID)
            normalized_chat_id = normalize_chat_id(chat_id)
            if not normalized_chat_id:
                return {
                    'success': False,
                    'error': 'Некорректный Chat ID. Используйте только числовые ID'
                }, 400
            
            # Проверяем, не существует ли уже такой chat ID
            existing = TelegramChatId.query.filter_by(chat_id=normalized_chat_id).first()
            if existing:
                return {
                    'success': False,
                    'error': 'Такой chat ID уже существует'
                }, 400
            
            # Создаем новый chat ID (используем нормализованный числовой ID)
            new_chat = TelegramChatId(
                chat_id=normalized_chat_id,
                chat_type=chat_type,
                description=description,
                enabled=True
            )
            new_chat.set_allowed_regions(allowed_regions if allowed_regions else None)
            db.session.add(new_chat)
            db.session.commit()
            
            # Отправляем текущее состояние всех базаров с включенными уведомлениями в новый chat ID
            try:
                send_current_status_to_chat_id(new_chat)
            except Exception as e:
                app.logger.error(f"Error sending current status to new chat ID: {e}", exc_info=True)
                # Не блокируем добавление chat ID из-за ошибки отправки
            
            return {
                'success': True,
                'message': 'Chat ID добавлен',
                'data': new_chat.to_dict()
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500

@telegram_ns.route('/telegram/chat-ids/<int:chat_id_id>')
class TelegramChatIdResource(Resource):
    @telegram_ns.doc('update_telegram_chat_id')
    @telegram_ns.expect(api.model('TelegramChatIdUpdate', {
        'enabled': fields.Boolean(description='Включен/выключен'),
        'description': fields.String(description='Описание'),
        'allowed_regions': fields.List(fields.String(), description='Список разрешенных областей (если пусто - все области)')
    }))
    def put(self, chat_id_id):
        """Обновить chat ID"""
        try:
            chat = TelegramChatId.query.get_or_404(chat_id_id)
            data = request.json
            
            # Запоминаем предыдущее состояние enabled
            was_enabled = chat.enabled
            
            if 'enabled' in data:
                chat.enabled = bool(data['enabled'])
            if 'description' in data:
                chat.description = data['description']
            if 'allowed_regions' in data:
                regions = data['allowed_regions']
                chat.set_allowed_regions(regions if regions else None)
            
            chat.updated_at = datetime.utcnow()
            db.session.commit()
            
            # Если chat ID был включен (был выключен, а теперь включен), отправляем текущее состояние
            if not was_enabled and chat.enabled:
                try:
                    send_current_status_to_chat_id(chat)
                except Exception as e:
                    app.logger.error(f"Error sending current status to enabled chat ID: {e}", exc_info=True)
                    # Не блокируем обновление chat ID из-за ошибки отправки
            
            return {
                'success': True,
                'message': 'Chat ID обновлен',
                'data': chat.to_dict()
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500
    
    @telegram_ns.doc('delete_telegram_chat_id')
    def delete(self, chat_id_id):
        """Удалить chat ID"""
        try:
            chat = TelegramChatId.query.get_or_404(chat_id_id)
            db.session.delete(chat)
            db.session.commit()
            
            return {
                'success': True,
                'message': 'Chat ID удален'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500

@telegram_ns.route('/telegram/webhook')
class TelegramWebhookResource(Resource):
    @telegram_ns.doc('telegram_webhook')
    def post(self):
        """Webhook для обработки сообщений от Telegram бота"""
        try:
            data = request.json
            message = data.get('message')
            callback_query = data.get('callback_query')
            
            # Получаем токен бота
            bot_token = TELEGRAM_BOT_TOKEN
            if not bot_token:
                telegram_settings = TelegramSettings.query.filter_by(enabled=True).first()
                if telegram_settings:
                    bot_token = telegram_settings.bot_token
            
            if not bot_token:
                return {'ok': False, 'error': 'Bot token not configured'}, 400
            
            # Обработка callback_query (нажатие на кнопку)
            if callback_query:
                chat_id = callback_query['message']['chat']['id']
                data_text = callback_query['data']
                
                # Обработка команд
                if data_text == 'list_bazars' or data_text == 'refresh_bazars':
                    keyboard = get_bazars_keyboard()
                    message_text = "🏪 *Список базаров*\n\nВыберите базар для просмотра информации:"
                    send_telegram_message(bot_token, chat_id, message_text, keyboard)[0]  # Используем только success (message_id не нужен для интерактивных сообщений)
                    # Отвечаем на callback
                    requests.post(f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery", 
                                json={'callback_query_id': callback_query['id']}, timeout=5)
                
                elif data_text.startswith('bazar_'):
                    service_id = int(data_text.split('_')[1])
                    service = BazarStatus.query.get(service_id)
                    if service:
                        # Получаем актуальную статистику камер
                        endpoint = {
                            'ip': service.bazar_ip,
                            'port': service.bazar_port,
                            'backendPort': service.backend_port,
                            'pgPort': service.pg_port
                        }
                        result = fetch_bazar_info(endpoint)
                        camera_stats = result.get('data') if result.get('success') else None
                        
                        message_text, keyboard = format_bazar_info(service, camera_stats)
                        # Редактируем сообщение вместо отправки нового
                        try:
                            message_id = callback_query['message']['message_id']
                            url = f"https://api.telegram.org/bot{bot_token}/editMessageText"
                            params = {
                                'chat_id': chat_id,
                                'message_id': message_id,
                                'text': message_text,
                                'parse_mode': 'Markdown',
                                'reply_markup': keyboard
                            }
                            requests.post(url, json=params, timeout=5)
                        except:
                            # Если не удалось отредактировать, отправляем новое
                            send_telegram_message(bot_token, chat_id, message_text, keyboard)[0]  # Используем только success (message_id не нужен для интерактивных сообщений)[0]  # Используем только success
                        # Отвечаем на callback
                        requests.post(f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery", 
                                    json={'callback_query_id': callback_query['id']}, timeout=5)
                
                elif data_text == 'overall_status':
                    # Общая статистика
                    services = BazarStatus.query.all()
                    online_count = len([s for s in services if s.status == 'online'])
                    offline_count = len([s for s in services if s.status == 'offline'])
                    
                    status_message = (
                        "📊 *Общая статистика*\n"
                        "━━━━━━━━━━━━━━━━━━━━\n\n"
                        f"🏪 Всего базаров: {len(services)}\n"
                        f"🟢 Онлайн: {online_count}\n"
                        f"🔴 Офлайн: {offline_count}\n\n"
                        "Используйте кнопку ниже для просмотра детальной информации"
                    )
                    keyboard = {
                        'inline_keyboard': [
                            [{'text': '🏪 Список базаров', 'callback_data': 'list_bazars'}]
                        ]
                    }
                    try:
                        message_id = callback_query['message']['message_id']
                        url = f"https://api.telegram.org/bot{bot_token}/editMessageText"
                        params = {
                            'chat_id': chat_id,
                            'message_id': message_id,
                            'text': status_message,
                            'parse_mode': 'Markdown',
                            'reply_markup': keyboard
                        }
                        requests.post(url, json=params, timeout=5)
                    except:
                        send_telegram_message(bot_token, chat_id, status_message, keyboard)[0]  # Используем только success
                    requests.post(f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery", 
                                json={'callback_query_id': callback_query['id']}, timeout=5)
                
                return {'ok': True}
            
            # Обработка обычных сообщений
            if message:
                chat_id = message['chat']['id']
                text = message.get('text', '')
                
                # Обработка команд
                if text.startswith('/start'):
                    # Получаем информацию о пользователе
                    chat = message.get('chat', {})
                    user_chat_id = str(chat.get('id'))
                    username = chat.get('username')
                    first_name = chat.get('first_name', '')
                    last_name = chat.get('last_name', '')
                    full_name = f"{first_name} {last_name}".strip()
                    
                    # Ищем запись только по числовому ID
                    chat_record = TelegramChatId.query.filter_by(chat_id=user_chat_id).first()
                    
                    # Если записи нет, логируем (не создаем автоматически)
                    if not chat_record:
                        app.logger.info(f"User {username} ({user_chat_id}) started bot but not in database. Add this chat_id manually: {user_chat_id}")
                    
                    welcome_message = (
                        "👋 *Добро пожаловать в систему мониторинга базаров!*\n\n"
                        "Доступные команды:\n"
                        "/bazars - Список всех базаров\n"
                        "/status - Общая статистика\n"
                        "/help - Справка\n\n"
                        "Используйте кнопки ниже для быстрого доступа:"
                    )
                    keyboard = {
                        'inline_keyboard': [
                            [{'text': '🏪 Список базаров', 'callback_data': 'list_bazars'}],
                            [{'text': '📊 Общая статистика', 'callback_data': 'overall_status'}]
                        ]
                    }
                    send_telegram_message(bot_token, chat_id, welcome_message, keyboard)[0]  # Используем только success
                
                elif text.startswith('/bazars') or text.startswith('/list'):
                    keyboard = get_bazars_keyboard()
                    message_text = "🏪 *Список базаров*\n\nВыберите базар для просмотра информации:"
                    send_telegram_message(bot_token, chat_id, message_text, keyboard)[0]  # Используем только success (message_id не нужен для интерактивных сообщений)
                
                elif text.startswith('/status') or text.startswith('/stats'):
                    # Общая статистика
                    services = BazarStatus.query.all()
                    online_count = len([s for s in services if s.status == 'online'])
                    offline_count = len([s for s in services if s.status == 'offline'])
                    
                    status_message = (
                        "📊 *Общая статистика*\n"
                        "━━━━━━━━━━━━━━━━━━━━\n\n"
                        f"🏪 Всего базаров: {len(services)}\n"
                        f"🟢 Онлайн: {online_count}\n"
                        f"🔴 Офлайн: {offline_count}\n\n"
                        "Используйте /bazars для просмотра детальной информации"
                    )
                    keyboard = {
                        'inline_keyboard': [
                            [{'text': '🏪 Список базаров', 'callback_data': 'list_bazars'}]
                        ]
                    }
                    send_telegram_message(bot_token, chat_id, status_message, keyboard)[0]  # Используем только success
                
                elif text.startswith('/help'):
                    help_message = (
                        "ℹ️ *Справка*\n\n"
                        "*Доступные команды:*\n"
                        "/start - Начать работу с ботом\n"
                        "/bazars - Список всех базаров\n"
                        "/status - Общая статистика\n"
                        "/help - Показать эту справку\n\n"
                        "Вы также можете использовать кнопки для навигации."
                    )
                    send_telegram_message(bot_token, chat_id, help_message)[0]  # Используем только success
                
                else:
                    # Неизвестная команда
                    help_message = (
                        "❓ Неизвестная команда.\n\n"
                        "Используйте /help для просмотра доступных команд."
                    )
                    keyboard = {
                        'inline_keyboard': [
                            [{'text': '🏪 Список базаров', 'callback_data': 'list_bazars'}],
                            [{'text': '📊 Статистика', 'callback_data': 'overall_status'}]
                        ]
                    }
                    send_telegram_message(bot_token, chat_id, help_message, keyboard)[0]  # Используем только success
                
                return {'ok': True}
            
            return {'ok': True}
            
        except Exception as e:
            app.logger.error(f"Error processing Telegram webhook: {e}", exc_info=True)
            return {'ok': False, 'error': str(e)}, 500

@telegram_ns.route('/telegram/set-webhook')
class TelegramSetWebhookResource(Resource):
    @telegram_ns.doc('set_telegram_webhook')
    def post(self):
        """Настроить webhook для Telegram бота"""
        try:
            data = request.json
            webhook_url = data.get('webhook_url')
            
            if not webhook_url:
                return {
                    'success': False,
                    'error': 'URL webhook обязателен'
                }, 400
            
            # Получаем токен бота
            bot_token = TELEGRAM_BOT_TOKEN
            if not bot_token:
                telegram_settings = TelegramSettings.query.filter_by(enabled=True).first()
                if telegram_settings:
                    bot_token = telegram_settings.bot_token
            
            if not bot_token:
                return {
                    'success': False,
                    'error': 'Bot token not configured'
                }, 400
            
            # Устанавливаем webhook
            url = f"https://api.telegram.org/bot{bot_token}/setWebhook"
            params = {
                'url': webhook_url
            }
            
            response = requests.post(url, json=params, timeout=5)
            
            if response.ok:
                result = response.json()
                return {
                    'success': True,
                    'message': 'Webhook установлен',
                    'data': result
                }
            else:
                return {
                    'success': False,
                    'error': response.text
                }, 400
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500

@telegram_ns.route('/telegram/test')
class TelegramTestResource(Resource):
    @telegram_ns.doc('test_telegram')
    def post(self):
        """Отправить тестовое сообщение в Telegram (во все настроенные chat ID)"""
        try:
            logger.info("Test Telegram notification endpoint called")
            # Используем статичный bot token
            bot_token = TELEGRAM_BOT_TOKEN
            logger.debug(f"Bot token present: {bool(bot_token)}")
            
            # Если статичный токен не задан, пытаемся получить из БД
            if not bot_token:
                telegram_settings = TelegramSettings.query.filter_by(enabled=True).first()
                if not telegram_settings or not telegram_settings.bot_token:
                    return {
                        'success': False,
                        'error': 'Telegram бот не настроен'
                    }, 400
                bot_token = telegram_settings.bot_token
            
            if not bot_token:
                return {
                    'success': False,
                    'error': 'Telegram бот не настроен'
                }, 400
            
            # Получаем все активные chat ID из БД
            telegram_chats = TelegramChatId.query.filter_by(enabled=True).all()
            if not telegram_chats:
                return {
                    'success': False,
                    'error': 'Нет настроенных Chat ID. Добавьте Chat ID через UI.'
                }, 400
            
            chat_ids = [chat.chat_id for chat in telegram_chats]
            
            # Отправляем тестовое сообщение во все настроенные chat ID
            message = "✅ *Тестовое уведомление*\n\nЭто тестовое сообщение от системы мониторинга базаров."
            success_count = 0
            errors = []
            
            logger.info(f"Attempting to send test message to {len(chat_ids)} chat ID(s): {chat_ids}")
            for chat_id in chat_ids:
                logger.debug(f"Attempting to send test message to chat_id: {chat_id}")
                success, message_id, error_detail = send_telegram_message(bot_token, chat_id, message)
                if success:
                    success_count += 1
                    logger.info(f"Successfully sent to {chat_id}")
                else:
                    error_msg = f"Failed to send to {chat_id}"
                    if error_detail:
                        error_msg += f": {error_detail}"
                    errors.append(error_msg)
                    logger.error(f"Failed to send to {chat_id}: {error_detail}")
            
            if success_count > 0:
                return {
                    'success': True,
                    'message': f'Тестовое сообщение отправлено в {success_count} из {len(chat_ids)} chat ID',
                    'sent_to': success_count,
                    'total': len(chat_ids),
                    'errors': errors if errors else None
                }
            else:
                error_details = ", ".join(errors) if errors else "Неизвестная ошибка"
                return {
                    'success': False,
                    'error': f'Не удалось отправить сообщение ни в один chat ID. Ошибки: {error_details}',
                    'chat_ids_attempted': chat_ids,
                    'errors': errors
                }, 400
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }, 500

@services_ns.route('/services/<int:service_id>/telegram-notifications')
class ServiceTelegramNotificationsResource(Resource):
    @services_ns.doc('toggle_telegram_notifications')
    @services_ns.expect(api.model('TelegramNotificationsToggle', {
        'enabled': fields.Boolean(required=True, description='Включить/выключить уведомления')
    }))
    def put(self, service_id):
        """Включить/выключить Telegram уведомления для конкретного базара"""
        try:
            service = BazarStatus.query.get_or_404(service_id)
            data = request.json
            enabled = data.get('enabled', False)
            check_interval = data.get('check_interval')  # Опциональный интервал проверки в секундах
            
            # Проверяем наличие токена и chat ID перед включением
            if enabled:
                bot_token = TELEGRAM_BOT_TOKEN
                
                if not bot_token:
                    telegram_settings = TelegramSettings.query.filter_by(enabled=True).first()
                    if telegram_settings:
                        bot_token = telegram_settings.bot_token
                
                # Проверяем наличие активных chat ID в БД
                telegram_chats = TelegramChatId.query.filter_by(enabled=True).all()
                if not bot_token:
                    return {
                        'success': False,
                        'error': 'Telegram bot token не настроен. Проверьте настройки бота.'
                    }, 400
                
                if not telegram_chats:
                    return {
                        'success': False,
                        'error': 'Нет настроенных Chat ID. Добавьте Chat ID через UI перед включением уведомлений.'
                    }, 400
            
            service.telegram_notifications_enabled = bool(enabled)
            
            # Устанавливаем интервал проверки если указан
            if check_interval is not None:
                service.notification_check_interval = int(check_interval)
            
            db.session.commit()
            
            # Если уведомления включены, сразу проверяем статус камер и отправляем уведомление
            if enabled:
                try:
                    # Получаем статистику камер
                    endpoint = {
                        'ip': service.bazar_ip,
                        'port': service.bazar_port,
                        'backendPort': service.backend_port,
                        'pgPort': service.pg_port
                    }
                    
                    result = fetch_bazar_info(endpoint)
                    if result['success']:
                        camera_stats = result['data'] if isinstance(result['data'], dict) else {}
                        offline_cameras = camera_stats.get('offlineCameras', 0)
                        total_cameras = camera_stats.get('totalCameras', 0)
                        online_cameras = camera_stats.get('onlineCameras', 0)
                        
                        # Отправляем текущую статистику
                        if total_cameras > 0:
                            notification_type = 'offline' if offline_cameras > 0 else 'online'
                            # Вычисляем время до следующего уведомления (только для офлайн)
                            next_notification_in = None
                            if notification_type == 'offline':
                                check_interval = service.notification_check_interval or 3600
                                next_notification_in = check_interval
                            
                            send_telegram_notification(
                                service.bazar_name,
                                service.city,
                                offline_cameras,
                                total_cameras,
                                notification_type,
                                service=service,
                                next_notification_in=next_notification_in
                            )
                            
                            # Обновляем счетчики
                            service.last_offline_cameras_count = offline_cameras
                            service.last_notification_time = datetime.utcnow()
                            db.session.commit()
                except Exception as e:
                    app.logger.error(f"Error sending initial notification: {e}", exc_info=True)
                    # Не блокируем включение уведомлений из-за ошибки отправки
            
            return {
                'success': True,
                'message': f'Уведомления для {service.bazar_name} {"включены" if enabled else "выключены"}',
                'data': service.to_dict()
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

# Обработчик ошибок для Flask-RESTX
@api.errorhandler(Exception)
def handle_error(e):
    """Обработчик ошибок для Flask-RESTX"""
    app.logger.error(f"Flask-RESTX error handler: {e}", exc_info=True)
    return {
        'success': False,
        'error': str(e)
    }, 500

# Флаг для отслеживания запуска планировщика
_scheduler_started = False

def initialize_app():
    """Инициализация приложения при первом запросе"""
    global _scheduler_started
    if not _scheduler_started:
        with app.app_context():
            # Убеждаемся, что директория для базы данных существует
            db_uri = app.config['SQLALCHEMY_DATABASE_URI']
            # Обрабатываем путь для SQLite (может быть sqlite:/// или sqlite:////)
            if db_uri.startswith('sqlite:////'):
                db_path = db_uri.replace('sqlite:////', '/')
            elif db_uri.startswith('sqlite:///'):
                db_path = db_uri.replace('sqlite:///', '')
            else:
                db_path = db_uri.replace('sqlite:///', '')
            
            db_dir = os.path.dirname(db_path)
            if db_dir and not os.path.exists(db_dir):
                try:
                    os.makedirs(db_dir, mode=0o777, exist_ok=True)
                    app.logger.info(f"Created database directory: {db_dir}")
                except Exception as e:
                    app.logger.error(f"Failed to create database directory {db_dir}: {e}")
                    # Пытаемся создать с другими правами
                    try:
                        os.makedirs(db_dir, mode=0o755, exist_ok=True)
                        app.logger.info(f"Created database directory with alternative permissions: {db_dir}")
                    except Exception as e2:
                        app.logger.error(f"Failed to create database directory with alternative permissions: {e2}")
            
            # Проверяем права доступа к директории
            if db_dir and os.path.exists(db_dir):
                if not os.access(db_dir, os.W_OK):
                    app.logger.warning(f"Directory {db_dir} is not writable, attempting to fix permissions...")
                    try:
                        os.chmod(db_dir, 0o777)
                        app.logger.info(f"Fixed permissions for directory: {db_dir}")
                    except Exception as e:
                        app.logger.warning(f"Could not fix permissions for directory {db_dir}: {e}")
            
            # Создаем таблицы если их нет
            try:
                db.create_all()
                app.logger.info("База данных инициализирована")
            except Exception as e:
                app.logger.error(f"Failed to initialize database: {e}", exc_info=True)
                # Пытаемся создать директорию еще раз и повторить
                if db_dir and not os.path.exists(db_dir):
                    try:
                        os.makedirs(db_dir, mode=0o755, exist_ok=True)
                        db.create_all()
                        app.logger.info("База данных инициализирована после создания директории")
                    except Exception as e2:
                        app.logger.error(f"Failed to initialize database after creating directory: {e2}", exc_info=True)
            
            # Запускаем фоновый планировщик для проверки камер
            start_background_scheduler()
        _scheduler_started = True

@app.before_request
def before_request():
    """Выполняется перед каждым запросом"""
    initialize_app()

if __name__ == '__main__':
    with app.app_context():
        # Убеждаемся, что директория для базы данных существует
        db_uri = app.config['SQLALCHEMY_DATABASE_URI']
        # Обрабатываем путь для SQLite (может быть sqlite:/// или sqlite:////)
        if db_uri.startswith('sqlite:////'):
            db_path = db_uri.replace('sqlite:////', '/')
        elif db_uri.startswith('sqlite:///'):
            db_path = db_uri.replace('sqlite:///', '')
        else:
            db_path = db_uri.replace('sqlite:///', '')
        
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            try:
                os.makedirs(db_dir, mode=0o777, exist_ok=True)
                app.logger.info(f"Created database directory: {db_dir}")
            except Exception as e:
                app.logger.error(f"Failed to create database directory {db_dir}: {e}")
                # Пытаемся создать с другими правами
                try:
                    os.makedirs(db_dir, mode=0o755, exist_ok=True)
                    app.logger.info(f"Created database directory with alternative permissions: {db_dir}")
                except Exception as e2:
                    app.logger.error(f"Failed to create database directory with alternative permissions: {e2}")
        
        # Проверяем права доступа к директории
        if db_dir and os.path.exists(db_dir):
            if not os.access(db_dir, os.W_OK):
                app.logger.warning(f"Directory {db_dir} is not writable, attempting to fix permissions...")
                try:
                    os.chmod(db_dir, 0o777)
                    app.logger.info(f"Fixed permissions for directory: {db_dir}")
                except Exception as e:
                    app.logger.warning(f"Could not fix permissions for directory {db_dir}: {e}")
        
        # Создаем таблицы если их нет
        try:
            db.create_all()
            app.logger.info("База данных инициализирована")
        except Exception as e:
            app.logger.error(f"Failed to initialize database: {e}", exc_info=True)
            # Пытаемся создать директорию еще раз и повторить
            if db_dir and not os.path.exists(db_dir):
                try:
                    os.makedirs(db_dir, mode=0o755, exist_ok=True)
                    db.create_all()
                    app.logger.info("База данных инициализирована после создания директории")
                except Exception as e2:
                    app.logger.error(f"Failed to initialize database after creating directory: {e2}", exc_info=True)
        
        # Запускаем фоновый планировщик для проверки камер
        if not _scheduler_started:
            start_background_scheduler()
            _scheduler_started = True
    
    app.logger.info("Запуск Bazar Monitoring API на http://0.0.0.0:5000")
    app.logger.info("Swagger документация: http://<server-ip>:5000/docs/")
    app.run(debug=True, host='0.0.0.0', port=5000)


#!/usr/bin/env python
"""
Скрипт для полного сброса миграций и пересоздания базы данных
"""
from app import app, db
import os
import shutil

def reset_migrations():
    """Исправляет проблемы с миграциями без удаления базы данных"""
    with app.app_context():
        print("Checking migration system...")
        
        # Получаем путь к базе данных
        db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        
        # Создаем директорию для базы данных если её нет
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
            print(f"SUCCESS: Created database directory: {db_dir}")
        
        # Проверяем, существует ли база данных
        db_exists = os.path.exists(db_path)
        
        if db_exists:
            try:
                # Подключаемся к БД и проверяем таблицу alembic_version
                from sqlalchemy import inspect, text
                inspector = inspect(db.engine)
                tables = inspector.get_table_names()
                
                # Если есть таблица alembic_version с проблемной ревизией, удаляем только эту таблицу
                if 'alembic_version' in tables:
                    try:
                        # Проверяем, есть ли проблемная ревизия
                        result = db.session.execute(text('SELECT version_num FROM alembic_version'))
                        version = result.scalar()
                        if version:
                            print(f"INFO: Found alembic_version: {version}")
                            # Удаляем только таблицу alembic_version (не всю БД!)
                            db.session.execute(text('DROP TABLE IF EXISTS alembic_version'))
                            db.session.commit()
                            print("SUCCESS: Removed problematic alembic_version table (database preserved)")
                    except Exception as e:
                        print(f"INFO: Could not check/remove alembic_version: {e}")
                        # Если не можем прочитать, просто удаляем таблицу
                        try:
                            db.session.execute(text('DROP TABLE IF EXISTS alembic_version'))
                            db.session.commit()
                            print("SUCCESS: Removed alembic_version table")
                        except:
                            pass
                
                # Создаем таблицы если их нет (не трогаем существующие)
                print("Ensuring all tables exist...")
                db.create_all()
                print("SUCCESS: All tables verified/created")
                
            except Exception as e:
                print(f"WARNING: Error checking database: {e}")
                # Fallback: просто создаем таблицы
                try:
                    db.create_all()
                    print("SUCCESS: Tables created/verified via fallback")
                except Exception as e2:
                    print(f"ERROR: Could not create tables: {e2}")
        else:
            # База данных не существует - создаем новую
            print("Database does not exist, creating new one...")
            db_dir = os.path.dirname(db_path)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir, exist_ok=True)
                print(f"SUCCESS: Created database directory: {db_dir}")
            
            db.create_all()
            print("SUCCESS: New database created with all tables")
        
        # Удаляем папку migrations/versions если она существует (но оставляем структуру)
        migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
        versions_dir = os.path.join(migrations_dir, 'versions')
        if os.path.exists(versions_dir):
            # Удаляем только файлы миграций, но сохраняем структуру
            for file in os.listdir(versions_dir):
                file_path = os.path.join(versions_dir, file)
                if os.path.isfile(file_path) and file.endswith('.py'):
                    os.remove(file_path)
            print("SUCCESS: Removed migration version files")
        
        # Создаем папку для БД если её нет
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
            print(f"SUCCESS: Created database directory: {db_dir}")
        
        # Создаем папку versions если её нет
        if not os.path.exists(versions_dir):
            os.makedirs(versions_dir, exist_ok=True)
            # Создаем __init__.py файл
            init_file = os.path.join(versions_dir, '__init__.py')
            if not os.path.exists(init_file):
                with open(init_file, 'w') as f:
                    f.write('')
            print(f"SUCCESS: Created migrations/versions directory")
        
        # Создаем таблицы напрямую через SQLAlchemy
        print("Creating database tables...")
        db.create_all()
        print("SUCCESS: Database tables created")
        
        # Проверяем и добавляем недостающие колонки в таблицу bazar_status
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('bazar_status')]
            
            # Список колонок, которые должны быть
            required_columns = {
                'telegram_notifications_enabled': 'BOOLEAN DEFAULT 0',
                'last_offline_cameras_count': 'INTEGER DEFAULT 0',
                'last_notification_time': 'DATETIME',
                'notification_check_interval': 'INTEGER DEFAULT 3600'
            }
            
            # Проверяем существование таблицы telegram_chat_id
            if 'telegram_chat_id' not in tables:
                print("Creating telegram_chat_id table...")
                db.create_all()
                print("SUCCESS: telegram_chat_id table created")
            else:
                # Проверяем колонки в таблице telegram_chat_id
                telegram_chat_columns = [col['name'] for col in inspector.get_columns('telegram_chat_id')]
                if 'allowed_regions' not in telegram_chat_columns:
                    try:
                        db.session.execute(text('ALTER TABLE telegram_chat_id ADD COLUMN allowed_regions TEXT'))
                        db.session.commit()
                        print("SUCCESS: Added column allowed_regions to telegram_chat_id table")
                    except Exception as e:
                        print(f"WARNING: Could not add column allowed_regions: {e}")
            
            # Добавляем недостающие колонки
            for col_name, col_type in required_columns.items():
                if col_name not in columns:
                    try:
                        db.session.execute(text(f'ALTER TABLE bazar_status ADD COLUMN {col_name} {col_type}'))
                        db.session.commit()
                        print(f"SUCCESS: Added column {col_name} to bazar_status table")
                    except Exception as e:
                        print(f"WARNING: Could not add column {col_name}: {e}")
        except Exception as e:
            print(f"WARNING: Could not check/add columns: {e}")
        
        print("SUCCESS: Migration system reset completed")
        print(f"Database path: {app.config['SQLALCHEMY_DATABASE_URI']}")

if __name__ == '__main__':
    reset_migrations()

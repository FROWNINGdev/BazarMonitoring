"""
Скрипт для автоматической инициализации базы данных и выполнения миграций
"""
from app import app, db, migrate
from flask_migrate import init, migrate as flask_migrate, upgrade
import os
import sys

def init_database():
    """Инициализирует базу данных с использованием Flask-Migrate"""
    with app.app_context():
        # Создаем папку для БД если её нет
        db_path = os.path.dirname(app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', ''))
        if db_path and not os.path.exists(db_path):
            os.makedirs(db_path, exist_ok=True)
            print(f"SUCCESS: Created database directory: {db_path}")
        
        # Проверяем, инициализированы ли миграции
        migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
        
        if not os.path.exists(migrations_dir):
            print("Initializing migration system...")
            try:
                init()
                print("SUCCESS: Migration system initialized")
            except Exception as e:
                print(f"INFO: Migrations already initialized or error: {e}")
        
        # Создаем автоматическую миграцию если есть изменения
        try:
            print("Checking for model changes...")
            flask_migrate(message='Auto-migration')
            print("SUCCESS: Migration created")
        except Exception as e:
            print(f"INFO: No changes for migration or error: {e}")
        
        # Применяем все миграции
        try:
            print("Applying migrations...")
            upgrade()
            print("SUCCESS: All migrations applied successfully")
        except Exception as e:
            print(f"WARNING: Error applying migrations: {e}")
            # Если миграции не работают, используем старый способ
            print("Attempting to create tables via db.create_all()...")
            db.create_all()
            print("SUCCESS: Tables created")
        
        print(f"SUCCESS: Database ready for work")
        print(f"Database path: {app.config['SQLALCHEMY_DATABASE_URI']}")

if __name__ == '__main__':
    init_database()


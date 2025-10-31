#!/usr/bin/env python
"""
Скрипт для управления миграциями базы данных
"""
from flask_migrate import init, migrate, upgrade, downgrade, stamp
from app import app, db
import sys
import os

def run_migrations():
    """Запускает процесс миграции"""
    with app.app_context():
        migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
        
        # Инициализация миграций если еще не инициализированы
        if not os.path.exists(migrations_dir):
            print("Initializing Flask-Migrate...")
            try:
                init()
                print("SUCCESS: Migration system initialized")
            except Exception as e:
                print(f"WARNING: Initialization error: {e}")
                return False
        
        # Создание миграции
        print("Creating migration based on model changes...")
        try:
            migrate(message='Add stream_port column')
            print("SUCCESS: Migration created")
        except Exception as e:
            print(f"INFO: {e}")
        
        # Применение миграций
        print("Applying migrations to database...")
        try:
            upgrade()
            print("SUCCESS: Migrations applied successfully")
            return True
        except Exception as e:
            print(f"ERROR: Migration application error: {e}")
            return False

def rollback_migration():
    """Откатывает последнюю миграцию"""
    with app.app_context():
        print("Rolling back last migration...")
        try:
            downgrade()
            print("SUCCESS: Migration rolled back")
            return True
        except Exception as e:
            print(f"ERROR: Rollback error: {e}")
            return False

def show_help():
    """Показывает справку по командам"""
    print("""
Database Migration Management

Commands:
    python migrate.py                - Create and apply migrations
    python migrate.py upgrade        - Apply all migrations
    python migrate.py downgrade      - Rollback last migration
    python migrate.py help           - Show this help

Examples:
    # First run (initialization and migration)
    python migrate.py
    
    # Apply migrations after code update
    python migrate.py upgrade
    
    # Rollback last changes
    python migrate.py downgrade
    """)

if __name__ == '__main__':
    command = sys.argv[1] if len(sys.argv) > 1 else 'migrate'
    
    if command == 'help' or command == '--help' or command == '-h':
        show_help()
    elif command == 'upgrade':
        with app.app_context():
            upgrade()
            print("SUCCESS: Migrations applied")
    elif command == 'downgrade':
        rollback_migration()
    elif command == 'migrate':
        run_migrations()
    else:
        print(f"ERROR: Unknown command: {command}")
        show_help()
        sys.exit(1)


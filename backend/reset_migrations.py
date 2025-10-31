#!/usr/bin/env python
"""
Скрипт для полного сброса миграций и пересоздания базы данных
"""
from app import app, db
import os
import shutil

def reset_migrations():
    """Полностью сбрасывает миграции и пересоздает базу данных"""
    with app.app_context():
        print("Resetting migration system...")
        
        # Удаляем папку migrations если она существует
        migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
        if os.path.exists(migrations_dir):
            shutil.rmtree(migrations_dir)
            print("SUCCESS: Removed migrations directory")
        
        # Удаляем базу данных если она существует
        db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        if os.path.exists(db_path):
            os.remove(db_path)
            print("SUCCESS: Removed old database")
        
        # Создаем папку для БД если её нет
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
            print(f"SUCCESS: Created database directory: {db_dir}")
        
        # Создаем таблицы напрямую через SQLAlchemy
        print("Creating database tables...")
        db.create_all()
        print("SUCCESS: Database tables created")
        
        print("SUCCESS: Migration system reset completed")
        print(f"Database path: {app.config['SQLALCHEMY_DATABASE_URI']}")

if __name__ == '__main__':
    reset_migrations()

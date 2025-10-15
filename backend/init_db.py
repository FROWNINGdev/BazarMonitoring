"""
Скрипт для автоматической инициализации базы данных
"""
from app import app, db
import os

def init_database():
    """Создает все таблицы в БД если их нет"""
    with app.app_context():
        # Создаем папку для БД если её нет
        db_path = os.path.dirname(app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', ''))
        if db_path and not os.path.exists(db_path):
            os.makedirs(db_path, exist_ok=True)
        
        # Создаем таблицы
        db.create_all()
        print("База данных успешно инициализирована")
        print(f"Путь к БД: {app.config['SQLALCHEMY_DATABASE_URI']}")

if __name__ == '__main__':
    init_database()


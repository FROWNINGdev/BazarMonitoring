#!/bin/bash
# Docker entrypoint скрипт для автоматических миграций

set -e

echo "Starting Bazar Monitoring Backend..."

# Ожидание готовности базы данных (если используется внешняя БД)
echo "Checking database availability..."
sleep 2

# Сброс миграций и создание базы данных
echo "Resetting migration system..."
python reset_migrations.py

# Проверка успешности сброса
if [ $? -eq 0 ]; then
    echo "SUCCESS: Migration system reset completed"
else
    echo "WARNING: Possible issues with migration reset"
fi

# Запуск основного приложения
echo "Starting Flask application..."
exec python app.py


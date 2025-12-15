#!/bin/bash
# Docker entrypoint скрипт для автоматических миграций

set -e

echo "🚀 Запуск Bazar Monitoring Backend..."

# Создаем директорию для базы данных если её нет
echo "📁 Проверка директории для базы данных..."
mkdir -p /app/instance
chmod 777 /app/instance

# Проверяем, что директория создана и доступна для записи
if [ ! -w /app/instance ]; then
    echo "⚠️ WARNING: Directory /app/instance is not writable, trying to fix permissions..."
    chmod -R 777 /app/instance || true
fi

echo "✅ Directory /app/instance is ready"

# Ожидание готовности базы данных (если используется внешняя БД)
echo "⏳ Проверка доступности базы данных..."
sleep 2

# Сброс миграций и создание базы данных
echo "🔄 Выполнение миграций базы данных..."
python reset_migrations.py

# Проверка успешности сброса
if [ $? -eq 0 ]; then
    echo "✅ SUCCESS: Migration system reset completed"
else
    echo "⚠️ WARNING: Possible issues with migration reset"
    # Пытаемся создать таблицы напрямую как fallback
    echo "🔄 Attempting fallback: creating tables directly..."
    python -c "from app import app, db; app.app_context().push(); db.create_all(); print('✅ Tables created via fallback')"
fi

# Запуск основного приложения
echo "🚀 Starting Flask application..."
exec python app.py


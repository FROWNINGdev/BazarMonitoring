# Backend Dockerfile
FROM python:3.11-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем requirements.txt и устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код приложения
COPY . .

# Создаем директорию для базы данных
RUN mkdir -p /app/instance

# Делаем entrypoint скрипт исполняемым
RUN chmod +x docker-entrypoint.sh

# Устанавливаем переменную окружения для БД
ENV SQLALCHEMY_DATABASE_URI=sqlite:////app/instance/bazar_monitoring.db

# Добавляем метаданные для GitHub Container Registry
LABEL org.opencontainers.image.source=https://github.com/FROWNINGdev/bazarmonitoring
LABEL org.opencontainers.image.description="Backend API for BazarMonitoring - System for monitoring bazaars in Uzbekistan"
LABEL org.opencontainers.image.licenses=MIT
LABEL org.opencontainers.image.title="BazarMonitoring Backend"
LABEL org.opencontainers.image.vendor="FROWNINGdev"

# Открываем порт
EXPOSE 5000

# Используем entrypoint для автоматических миграций
ENTRYPOINT ["./docker-entrypoint.sh"]


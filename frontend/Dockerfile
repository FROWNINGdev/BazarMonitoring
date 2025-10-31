# Frontend Dockerfile
FROM nginx:alpine

# Удаляем дефолтную конфигурацию nginx
RUN rm /etc/nginx/conf.d/default.conf

# Копируем нашу конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/

# Копируем frontend файлы
COPY index.html /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY favicon.png /usr/share/nginx/html/
COPY fon.jpg /usr/share/nginx/html/
# Добавлено: превью видео
COPY preview /usr/share/nginx/html/preview/

# Копируем GeoJSON файлы
COPY Uzb /usr/share/nginx/html/Uzb/

# Добавляем метаданные для GitHub Container Registry
LABEL org.opencontainers.image.source=https://github.com/FROWNINGdev/bazarmonitoring
LABEL org.opencontainers.image.description="Frontend for BazarMonitoring - System for monitoring bazaars in Uzbekistan"
LABEL org.opencontainers.image.licenses=MIT
LABEL org.opencontainers.image.title="BazarMonitoring Frontend"
LABEL org.opencontainers.image.vendor="FROWNINGdev"

# Открываем порт
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]

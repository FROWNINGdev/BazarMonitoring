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

# Открываем порт
EXPOSE 80

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]

# 🏪 BazarMonitoring - Система мониторинга базаров Узбекистана

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3+-green.svg)](https://flask.palletsprojects.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-success.svg)](https://opensource.org/)

> Современная веб-платформа для мониторинга и управления сетью базаров по всей территории Узбекистана с интерактивной картой, статистикой и аналитикой.

## 📋 Содержание

- [Особенности](#-особенности)
- [Технологический стек](#-технологический-стек)
- [Быстрый старт](#-быстрый-старт)
- [Установка](#-установка)
- [Использование](#-использование)
- [API Документация](#-api-документация)
- [Структура проекта](#-структура-проекта)
- [Вклад в проект](#-вклад-в-проект)
- [Лицензия](#-лицензия)

## ✨ Особенности

### 🎯 Мониторинг и управление
- ✅ **Реальное время мониторинга** - отслеживание статуса всех базаров онлайн/офлайн
- ✅ **Интерактивная карта** - визуализация базаров на карте Узбекистана с границами областей
- ✅ **Детальная статистика** - аналитика по камерам, ROI (области интереса), статусам
- ✅ **Автоматическое логирование** - полная история изменений статусов и событий

### 📊 Аналитика и отчеты
- 📈 **Общая статистика** - базары, камеры, доступность
- 📊 **Статистика по областям** - разбивка данных по регионам Узбекистана
- 📄 **Экспорт в Excel** - детальные отчеты с данными по каждому базару
- 🎥 **Информация о камерах** - количество, статус (онлайн/офлайн), ROI

### 🛠️ Административные функции
- ➕ **Добавление базаров** - простой интерфейс для добавления новых сервисов
- ✏️ **Редактирование** - изменение данных базаров (контакты, координаты, порты)
- 🗑️ **Удаление** - управление списком базаров
- 📞 **Контактная информация** - хранение контактов Click и SCC

### 🎨 Пользовательский интерфейс
- 🌙 **Темная/светлая тема** - переключение между темами оформления
- 🌍 **Многоязычность** - поддержка русского, узбекского и английского языков
- 📱 **Адаптивный дизайн** - работает на всех устройствах
- ⚡ **Быстрая работа** - оптимизированная производительность

## 🛠️ Технологический стек

### Backend
- **Python 3.11** - основной язык программирования
- **Flask** - веб-фреймворк
- **SQLAlchemy** - ORM для работы с базой данных
- **Flask-Migrate** - управление миграциями БД
- **Flask-RESTX** - REST API с Swagger документацией
- **SQLite** - база данных

### Frontend
- **HTML5/CSS3** - разметка и стилизация
- **JavaScript (ES6+)** - интерактивность
- **Leaflet.js** - интерактивные карты
- **Chart.js** - графики и диаграммы
- **SheetJS (XLSX)** - экспорт в Excel

### DevOps
- **Docker** - контейнеризация
- **Docker Compose** - оркестрация контейнеров
- **Nginx** - веб-сервер для фронтенда

## 🚀 Быстрый старт

### Предварительные требования

- [Docker](https://www.docker.com/get-started) и [Docker Compose](https://docs.docker.com/compose/)
- Или Python 3.11+ для локальной установки

### Запуск с Docker (рекомендуется)

```bash
# Клонируйте репозиторий
git clone https://github.com/FROWNINGdev/bazarmonitoring.git
cd bazarmonitoring

# Запустите приложение
docker-compose up --build

# Приложение будет доступно по адресу:
# Frontend: http://localhost:80
# Backend API: http://localhost:5000
# API Docs: http://localhost:5000/docs/
```

### Локальная установка

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/FROWNINGdev/bazarmonitoring.git
cd bazarmonitoring

# 2. Установите зависимости backend
cd backend
pip install -r requirements.txt

# 3. Инициализируйте базу данных
python reset_migrations.py

# 4. Запустите backend
python app.py

# 5. В другом терминале запустите frontend
cd frontend
python -m http.server 8080
```

## 📖 Установка

### Пошаговая установка

1. **Клонирование репозитория**
   ```bash
   git clone https://github.com/FROWNINGdev/bazarmonitoring.git
   cd bazarmonitoring
   ```

2. **Настройка переменных окружения** (опционально)
   ```bash
   # В backend/ создайте .env файл
   SQLALCHEMY_DATABASE_URI=sqlite:///instance/bazar_monitoring.db
   FLASK_ENV=development
   ```

3. **Сборка и запуск Docker контейнеров**
   ```bash
   docker-compose up --build -d
   ```

4. **Проверка работоспособности**
   ```bash
   # Проверка API
   curl http://localhost:5000/api/health
   
   # Проверка frontend
   curl http://localhost/
   ```

## 🎮 Использование

### Веб-интерфейс

1. Откройте браузер и перейдите по адресу `http://localhost:80`
2. Используйте фильтры для поиска базаров
3. Кликните на базар на карте для просмотра детальной информации
4. Используйте меню для доступа к:
   - Общей статистике
   - Логам системы
   - Административной панели

### API Использование

```bash
# Получить список всех базаров
curl http://localhost:5000/api/bazars

# Получить статистику
curl http://localhost:5000/api/statistics

# Получить логи
curl http://localhost:5000/api/logs?limit=50

# Добавить новый базар
curl -X POST http://localhost:5000/api/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Название базара",
    "city": "Город",
    "ip": "192.168.1.100",
    "port": 80,
    "backend_port": 8200,
    "pg_port": 5400
  }'
```

## 📚 API Документация

Полная документация API доступна через Swagger UI:
- **URL**: `http://localhost:5000/docs/`
- Интерактивное тестирование API endpoints
- Описание всех параметров и ответов

### Основные Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/bazars` | Получить список всех базаров |
| GET | `/api/status` | Получить статус из БД |
| GET | `/api/statistics` | Общая статистика |
| GET | `/api/cameras/statistics` | Статистика камер |
| GET | `/api/logs` | Получить логи |
| POST | `/api/services` | Добавить новый сервис |
| PUT | `/api/services/<id>` | Обновить сервис |
| DELETE | `/api/services/<id>` | Удалить сервис |

## 📦 GitHub Packages

Проект автоматически публикует пакеты в GitHub Packages:

- **🐳 Docker Images** - готовые к использованию контейнеры backend и frontend
- **📦 npm Package** - frontend компоненты для npm
- **🐍 Python Package** - backend API для pip

Подробная инструкция по использованию: [PACKAGES.md](PACKAGES.md)

### Быстрая установка через Docker

```bash
# Backend
docker pull ghcr.io/frowningdev/bazarmonitoring/backend:latest

# Frontend
docker pull ghcr.io/frowningdev/bazarmonitoring/frontend:latest
```

## 📁 Структура проекта

```
bazarmonitoring/
├── backend/                 # Backend приложение
│   ├── app.py              # Основной файл Flask приложения
│   ├── init_db.py          # Инициализация базы данных
│   ├── migrate.py           # Скрипт миграций
│   ├── reset_migrations.py # Сброс миграций
│   ├── docker-entrypoint.sh # Docker entrypoint
│   ├── requirements.txt    # Python зависимости
│   ├── Dockerfile          # Docker образ для backend
│   └── instance/           # SQLite база данных
│
├── frontend/                # Frontend приложение
│   ├── index.html          # Главная страница
│   ├── script.js           # JavaScript логика
│   ├── styles.css          # Стили
│   ├── nginx.conf          # Конфигурация Nginx
│   ├── Dockerfile          # Docker образ для frontend
│   └── Uzb/                # GeoJSON данные для карты
│
├── docker-compose.yml      # Docker Compose конфигурация
├── README.md               # Этот файл
├── LICENSE                 # Лицензия MIT
└── CONTRIBUTING.md         # Руководство для контрибьюторов
```

## 🤝 Вклад в проект

Мы приветствуем любой вклад в проект! Пожалуйста, ознакомьтесь с [CONTRIBUTING.md](CONTRIBUTING.md) для получения подробной информации.

### Как внести вклад

1. **Fork** репозитория
2. Создайте **ветку** для вашей функции (`git checkout -b feature/AmazingFeature`)
3. **Commit** ваши изменения (`git commit -m 'Add some AmazingFeature'`)
4. **Push** в ветку (`git push origin feature/AmazingFeature`)
5. Откройте **Pull Request**

### Стиль кода

- Python: следуйте [PEP 8](https://pep8.org/)
- JavaScript: используйте ESLint конфигурацию
- Коммиты: используйте понятные сообщения на русском или английском

## 👥 Авторы

- **FROWNINGdev** - *Основной разработчик* - [GitHub](https://github.com/FROWNINGdev)
- **asadullokhn** - *Со-разработчик* - [GitHub](https://github.com/asadullokhn)

Смотрите также список [участников](https://github.com/FROWNINGdev/bazarmonitoring/contributors), которые внесли вклад в этот проект.

## 📝 Лицензия

Этот проект распространяется под лицензией MIT. Смотрите файл [LICENSE](LICENSE) для подробной информации.

## 🙏 Благодарности

- [Leaflet.js](https://leafletjs.com/) за отличную библиотеку карт
- [Flask](https://flask.palletsprojects.com/) за простой и мощный фреймворк
- Сообществу open source за вдохновение и поддержку

## 📞 Контакты

- **Email**: support@bazar-monitoring.uz
- **Issues**: [GitHub Issues](https://github.com/FROWNINGdev/bazarmonitoring/issues)
- **Discussions**: [GitHub Discussions](https://github.com/FROWNINGdev/bazarmonitoring/discussions)

## ⭐ Статус проекта

![GitHub stars](https://img.shields.io/github/stars/FROWNINGdev/bazarmonitoring?style=social)
![GitHub forks](https://img.shields.io/github/forks/FROWNINGdev/bazarmonitoring?style=social)
![GitHub issues](https://img.shields.io/github/issues/FROWNINGdev/bazarmonitoring)
![GitHub pull requests](https://img.shields.io/github/issues-pr/FROWNINGdev/bazarmonitoring)

---

⭐ Если этот проект был полезен, поставьте звезду на GitHub!


# 📦 GitHub Packages - Инструкция по использованию

Проект BazarMonitoring публикует пакеты в GitHub Packages для удобного использования и распространения.

## 🐳 Docker Container Images

### Backend Image

```bash
# Pull image
docker pull ghcr.io/frowningdev/bazarmonitoring/backend:latest

# Или конкретная версия
docker pull ghcr.io/frowningdev/bazarmonitoring/backend:v1.0.0

# Использование
docker run -p 5000:5000 ghcr.io/frowningdev/bazarmonitoring/backend:latest
```

### Frontend Image

```bash
# Pull image
docker pull ghcr.io/frowningdev/bazarmonitoring/frontend:latest

# Или конкретная версия
docker pull ghcr.io/frowningdev/bazarmonitoring/frontend:v1.0.0

# Использование
docker run -p 80:80 ghcr.io/frowningdev/bazarmonitoring/frontend:latest
```

### Использование с docker-compose

```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/frowningdev/bazarmonitoring/backend:latest
    ports:
      - "5000:5000"
    environment:
      - SQLALCHEMY_DATABASE_URI=sqlite:///instance/bazar_monitoring.db

  frontend:
    image: ghcr.io/frowningdev/bazarmonitoring/frontend:latest
    ports:
      - "80:80"
    depends_on:
      - backend
```

## 📦 npm Package (Frontend)

### Установка

```bash
# Настройте .npmrc
echo "@frowningdev:registry=https://npm.pkg.github.com" >> .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc

# Установите пакет
npm install @frowningdev/bazarmonitoring-frontend
```

### Использование

```javascript
// В вашем проекте
import 'bazarmonitoring-frontend/styles.css';
// Используйте компоненты
```

## 🐍 Python Package (Backend)

### Установка

```bash
# Настройте pip
echo "[global]
extra-index-url = https://__token__:YOUR_GITHUB_TOKEN@pkg.github.com/FROWNINGdev
" > ~/.pip/pip.conf

# Установите пакет
pip install bazarmonitoring-backend
```

### Использование

```python
from bazarmonitoring_backend import app, db

# Используйте компоненты backend
```

## 🔐 Настройка аутентификации

### GitHub Token

Для доступа к пакетам необходим GitHub Personal Access Token:

1. Создайте токен на: https://github.com/settings/tokens
2. Выберите права: `read:packages`
3. Используйте токен для аутентификации

### Docker

```bash
# Login в GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

### npm

```bash
# Создайте .npmrc
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> .npmrc
```

### pip

```bash
# Добавьте в pip.conf
echo "[global]
extra-index-url = https://__token__:YOUR_GITHUB_TOKEN@pkg.github.com/FROWNINGdev
" > ~/.pip/pip.conf
```

## 📋 Версии пакетов

Пакеты публикуются автоматически при:
- Push в master/main ветку → `latest`
- Создании релиза → версия релиза (например `v1.0.0`)
- Tag версии → соответствующая версия

## 🔗 Полезные ссылки

- [GitHub Packages](https://github.com/FROWNINGdev/bazarmonitoring/packages)
- [Docker Images](https://github.com/FROWNINGdev/bazarmonitoring/pkgs/container/backend)
- [npm Package](https://github.com/FROWNINGdev/bazarmonitoring/pkgs/npm/bazarmonitoring-frontend)
- [Python Package](https://github.com/FROWNINGdev/bazarmonitoring/pkgs/container/bazarmonitoring-backend)

---

**Пакеты автоматически публикуются при создании релизов!** 🚀


# 🚀 Руководство по созданию релизов

Инструкции по созданию и публикации релизов для BazarMonitoring.

## 📋 Автоматическое создание релизов

### Способ 1: Через GitHub Actions (рекомендуется)

Релизы создаются автоматически при создании git tag:

```bash
# 1. Создайте tag с версией
git tag -a v1.0.0 -F release_tag_message.txt

# 2. Отправьте tag в GitHub
git push origin v1.0.0

# GitHub Actions автоматически создаст релиз!
```

### Способ 2: Через PowerShell скрипт

```bash
# Установите GitHub Token (один раз)
$env:GITHUB_TOKEN = "your_github_token_here"

# Запустите скрипт
.\create_release.ps1 -Version 1.0.0
```

### Способ 3: Вручную на GitHub

1. Перейдите на https://github.com/FROWNINGdev/bazarmonitoring/releases/new
2. Выберите существующий tag или создайте новый
3. Заполните описание релиза
4. Нажмите "Publish release"

## 🏷️ Создание нового релиза

### Шаг 1: Обновите версию

Перед созданием релиза обновите версию в:
- `README.md` (если указана)
- `backend/app.py` (версия API)
- Других местах где указана версия

### Шаг 2: Создайте коммит

```bash
git add .
git commit -m "chore: подготовка к релизу v1.0.0"
git push origin master
```

### Шаг 3: Создайте tag

```bash
# Создайте файл с описанием релиза
# Или используйте готовый release_tag_message.txt

git tag -a v1.0.0 -F release_tag_message.txt

# Проверьте tag
git show v1.0.0
```

### Шаг 4: Отправьте tag

```bash
# Отправка одного tag
git push origin v1.0.0

# Или отправка всех tags
git push origin --tags
```

### Шаг 5: Проверьте релиз

После отправки tag:
- GitHub Actions автоматически создаст релиз (через 1-2 минуты)
- Проверьте на https://github.com/FROWNINGdev/bazarmonitoring/releases

## 📝 Формат версий

Используем [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0) - несовместимые изменения API
- **MINOR** (0.1.0) - новая функциональность (обратно совместима)
- **PATCH** (0.0.1) - исправления ошибок

Примеры:
- `v1.0.0` - первый стабильный релиз
- `v1.1.0` - новая функциональность
- `v1.1.1` - исправления ошибок
- `v2.0.0` - крупные изменения

## 📋 Шаблон описания релиза

```markdown
## 🎉 Release v1.0.0 - BazarMonitoring

### ✨ Новые функции
- Добавлена новая функция X
- Улучшена функция Y

### 🐛 Исправления
- Исправлена ошибка Z
- Улучшена производительность

### 📚 Изменения
- Обновлена документация
- Улучшен UI

### 📦 Установка
```bash
git clone https://github.com/FROWNINGdev/bazarmonitoring.git
cd bazarmonitoring
docker-compose up --build
```

### 👥 Авторы
- FROWNINGdev
- asadullokhn
```

## 🔧 GitHub Token

Для автоматического создания релизов через скрипт:

1. Создайте Personal Access Token на GitHub:
   - Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Создайте токен с правами `repo`

2. Установите как переменную окружения:
   ```powershell
   $env:GITHUB_TOKEN = "your_token_here"
   ```

3. Или добавьте в `.env` файл (не коммитьте в git!)

## ✅ Чеклист перед релизом

- [ ] Все изменения закоммичены и запушены
- [ ] Версия обновлена во всех файлах
- [ ] Тесты пройдены
- [ ] Документация обновлена
- [ ] CHANGELOG.md обновлен (если используется)
- [ ] Tag создан с правильной версией
- [ ] Tag отправлен в GitHub
- [ ] Релиз создан и проверен

## 🔗 Полезные ссылки

- [Semantic Versioning](https://semver.org/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Git Tags](https://git-scm.com/book/en/v2/Git-Basics-Tagging)

---

Удачных релизов! 🚀


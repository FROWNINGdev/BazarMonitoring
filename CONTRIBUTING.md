# 🤝 Руководство по внесению вклада

Спасибо за интерес к участию в проекте BazarMonitoring! Мы рады любому вкладу.

## 📋 Содержание

- [Код поведения](#-код-поведения)
- [Как внести вклад](#-как-внести-вклад)
- [Процесс разработки](#-процесс-разработки)
- [Стиль кода](#-стиль-кода)
- [Сообщения коммитов](#-сообщения-коммитов)
- [Pull Requests](#-pull-requests)

## 📜 Код поведения

Этот проект следует [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). Участвуя в проекте, вы соглашаетесь соблюдать этот код.

## 🚀 Как внести вклад

### Сообщить об ошибке

Если вы нашли ошибку:

1. Убедитесь, что ошибка еще не была зарегистрирована в [Issues](https://github.com/FROWNINGdev/bazarmonitoring/issues)
2. Если нет, создайте новый Issue с:
   - Четким описанием проблемы
   - Шагами для воспроизведения
   - Ожидаемым поведением
   - Фактическим поведением
   - Скриншотами (если применимо)
   - Версией ПО и окружением

### Предложить новую функцию

Если у вас есть идея для новой функции:

1. Создайте Issue с меткой `enhancement`
2. Опишите функцию и ее преимущества
3. Обсудите реализацию с командой

### Исправить ошибку или добавить функцию

1. **Fork** репозитория
2. **Клонируйте** ваш fork:
   ```bash
   git clone https://github.com/FROWNINGdev/bazarmonitoring.git
   cd bazarmonitoring
   ```
3. **Создайте ветку** для вашего изменения:
   ```bash
   git checkout -b feature/your-feature-name
   # или
   git checkout -b fix/your-bug-fix
   ```
4. **Внесите изменения** и протестируйте их
5. **Commit** ваши изменения:
   ```bash
   git add .
   git commit -m "feat: добавлена новая функция"
   ```
6. **Push** в ваш fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Создайте Pull Request** на GitHub

## 🔧 Процесс разработки

### Настройка окружения

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/yourusername/bazariplist.git
cd bazariplist

# 2. Создайте виртуальное окружение (для backend)
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows

# 3. Установите зависимости
pip install -r requirements.txt

# 4. Инициализируйте базу данных
python reset_migrations.py
```

### Запуск для разработки

```bash
# Backend
cd backend
python app.py

# Frontend (в другом терминале)
cd frontend
python -m http.server 8080
```

Или используйте Docker:

```bash
docker-compose up
```

## 📝 Стиль кода

### Python

- Следуйте [PEP 8](https://pep8.org/)
- Используйте строки длиной не более 120 символов
- Документируйте функции и классы
- Используйте type hints где возможно

**Пример:**
```python
def get_bazar_by_ip(ip: str) -> dict:
    """
    Получить информацию о базаре по IP адресу.
    
    Args:
        ip: IP адрес базара
        
    Returns:
        dict: Информация о базаре или None
    """
    # код функции
    pass
```

### JavaScript

- Используйте современный ES6+ синтаксис
- Используйте `const` и `let` вместо `var`
- Следуйте соглашениям об именовании:
  - camelCase для переменных и функций
  - PascalCase для классов
  - UPPER_SNAKE_CASE для констант

**Пример:**
```javascript
const API_BASE_URL = 'http://localhost:5000/api';

async function fetchBazars() {
    try {
        const response = await fetch(`${API_BASE_URL}/bazars`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching bazars:', error);
        throw error;
    }
}
```

### HTML/CSS

- Используйте семантический HTML
- Следуйте методологии BEM для CSS классов
- Используйте CSS переменные для цветов и размеров

## 💬 Сообщения коммитов

Используйте [Conventional Commits](https://www.conventionalcommits.org/) формат:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Типы коммитов

- `feat`: Новая функция
- `fix`: Исправление ошибки
- `docs`: Изменения в документации
- `style`: Форматирование, отсутствие изменений в коде
- `refactor`: Рефакторинг кода
- `test`: Добавление или исправление тестов
- `chore`: Изменения в процессе сборки или вспомогательных инструментах

### Примеры

```
feat(backend): добавлен endpoint для статистики камер
fix(frontend): исправлена ошибка загрузки карты
docs(readme): обновлена инструкция по установке
refactor(api): оптимизирована работа с базой данных
```

## 🔍 Pull Requests

### Перед созданием PR

- ✅ Убедитесь, что ваш код следует стилю проекта
- ✅ Добавьте комментарии к сложным участкам кода
- ✅ Обновите документацию, если необходимо
- ✅ Убедитесь, что все тесты проходят
- ✅ Проверьте, что нет конфликтов с основной веткой

### Шаблон PR

При создании Pull Request укажите:

1. **Описание**: Что изменилось и почему
2. **Тип изменения**:
   - [ ] Новые функции
   - [ ] Исправление ошибок
   - [ ] Рефакторинг
   - [ ] Документация
   - [ ] Стиль кода
3. **Как протестировать**: Шаги для проверки изменений
4. **Чеклист**:
   - [ ] Код соответствует стилю проекта
   - [ ] Добавлены комментарии к коду
   - [ ] Обновлена документация
   - [ ] Изменения не вызывают новых предупреждений
   - [ ] Добавлены тесты (если применимо)

### Совместные коммиты

Если вы работаете вместе с другим участником:

```bash
# Укажите соавторов в сообщении коммита
git commit -m "feat: добавлена новая функция

Co-authored-by: Name <name@example.com>
Co-authored-by: Another Name <another@example.com>"
```

Или используйте шаблон:

```
git commit -m "feat: совместная работа над функцией

Соавторы:
- Имя участника 1 <email1@example.com>
- Имя участника 2 <email2@example.com>
```

## 🧪 Тестирование

Перед отправкой PR убедитесь:

1. Локально протестировали изменения
2. Проверили на разных браузерах (для frontend)
3. Проверили работу с Docker (если изменили конфигурацию)

## 📚 Ресурсы

- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [PEP 8 Style Guide](https://pep8.org/)

## ❓ Вопросы?

Если у вас есть вопросы, создайте [Discussion](https://github.com/FROWNINGdev/bazarmonitoring/discussions) или [Issue](https://github.com/FROWNINGdev/bazarmonitoring/issues).

---

Спасибо за ваш вклад! 🎉


# 🔧 Настройка Git для совместной работы

Инструкции по настройке Git репозитория и создания совместных коммитов.

## 📦 Добавление файлов в Git

### Шаг 1: Проверка статуса

```bash
# Проверьте, какие файлы нужно добавить
git status
```

### Шаг 2: Добавление новых файлов

```bash
# Добавить все файлы
git add .

# Или добавить конкретные файлы
git add README.md LICENSE CONTRIBUTING.md COLLABORATION.md .gitignore
```

### Шаг 3: Проверка изменений

```bash
# Посмотреть, что будет в коммите
git status

# Посмотреть изменения
git diff --staged
```

### Шаг 4: Создание коммита

#### Обычный коммит
```bash
git commit -m "docs: добавлен README с badges и документация проекта"
```

#### Совместный коммит с одним соавтором
```bash
git commit -m "docs: добавлен README с badges и документация проекта

Добавлены:
- README.md с красивыми badges и описанием
- LICENSE (MIT)
- CONTRIBUTING.md для контрибьюторов
- COLLABORATION.md для совместной работы
- .gitignore для исключения ненужных файлов

Co-authored-by: Имя Коллеги <email@example.com>"
```

#### Совместный коммит с несколькими соавторами
```bash
git commit -m "docs: добавлена полная документация проекта

Добавлены файлы для open source проекта:
- README.md с badges, описанием и инструкциями
- LICENSE (MIT)
- CONTRIBUTING.md - руководство для контрибьюторов
- COLLABORATION.md - инструкции по совместной работе
- .gitignore - исключения для git
- GIT_SETUP.md - инструкции по настройке git

Co-authored-by: Первый Участник <first@example.com>
Co-authored-by: Второй Участник <second@example.com>"
```

## 🌐 Настройка удаленного репозитория

### Если репозиторий еще не создан на GitHub

1. **Создайте репозиторий на GitHub**
   - Перейдите на https://github.com/new
   - Название: `bazarmonitoring`
   - Описание: "Система мониторинга базаров Узбекистана"
   - Тип: Public (для open source)
   - НЕ добавляйте README, .gitignore или LICENSE (уже есть локально)

2. **Добавьте удаленный репозиторий**

```bash
# Добавьте удаленный репозиторий
git remote add origin https://github.com/FROWNINGdev/bazarmonitoring.git

# Проверьте
git remote -v
```

3. **Push изменений**

```bash
# Первый push
git push -u origin main

# Или если используется master
git push -u origin master
```

### Если репозиторий уже существует

```bash
# Проверьте текущие удаленные репозитории
git remote -v

# Если origin не настроен, добавьте его
git remote add origin https://github.com/FROWNINGdev/bazarmonitoring.git

# Обновите основную ветку
git branch -M main

# Push изменений
git push -u origin main
```

## 🤝 Создание совместного коммита

### Вариант 1: Один коммит от имени обоих

```bash
# Добавьте файлы
git add .

# Создайте коммит с соавторами
git commit -m "docs: добавлена документация для open source проекта

Добавлены:
- README.md с badges и описанием
- LICENSE (MIT)
- CONTRIBUTING.md
- COLLABORATION.md

Co-authored-by: Ваш Коллега <colleague@example.com>"

# Push
git push origin main
```

### Вариант 2: Отдельные коммиты с указанием соавторов

```bash
# Первый участник делает коммит
git commit -m "docs: добавлен README.md

Co-authored-by: Коллега <colleague@example.com>"

# Второй участник делает коммит
git commit -m "docs: добавлены LICENSE и CONTRIBUTING.md

Co-authored-by: Первый <first@example.com>"
```

## 📝 Полный пример для первого коммита

```bash
# 1. Инициализация git (если еще не сделано)
git init

# 2. Добавление всех файлов
git add .

# 3. Создание первого коммита (совместного)
git commit -m "docs: первоначальная документация проекта

Добавлена полная документация для open source проекта BazarMonitoring:
- README.md с badges, описанием и инструкциями
- LICENSE (MIT) для open source
- CONTRIBUTING.md - руководство для контрибьюторов
- COLLABORATION.md - инструкции по совместной работе
- GIT_SETUP.md - инструкции по настройке git
- .gitignore - исключения файлов из git

Co-authored-by: Ваш Коллега <colleague@example.com>"

# 4. Создание ветки main (если используете master)
git branch -M main

# 5. Добавление удаленного репозитория
git remote add origin https://github.com/FROWNINGdev/bazarmonitoring.git

# 6. Push в GitHub
git push -u origin main
```

## ✅ Проверка после коммита

```bash
# Посмотреть последний коммит
git log -1

# Посмотреть авторов
git log --format="%h - %an <%ae> : %s"

# Посмотреть на GitHub
# Откройте https://github.com/FROWNINGdev/bazarmonitoring
# Перейдите в Insights -> Contributors
```

## 🔄 Обновление README badges

После создания репозитория обновите URLs в README.md:

```markdown
![GitHub stars](https://img.shields.io/github/stars/FROWNINGdev/bazarmonitoring?style=social)
![GitHub forks](https://img.shields.io/github/forks/FROWNINGdev/bazarmonitoring?style=social)
```

Замените `FROWNINGdev` на ваш реальный username на GitHub (если отличается).

## 📋 Чеклист перед публикацией

- [ ] Все файлы добавлены в git
- [ ] README.md создан с badges
- [ ] LICENSE файл добавлен
- [ ] CONTRIBUTING.md создан
- [ ] .gitignore настроен
- [ ] Соавторы указаны в коммите
- [ ] Удаленный репозиторий настроен
- [ ] Изменения запушены в GitHub
- [ ] Репозиторий публичный
- [ ] Badges работают (после первого push)

## 🚀 Быстрые команды

```bash
# Добавить все и закоммитить
git add . && git commit -m "your message"

# Push с отслеживанием
git push -u origin main

# Посмотреть статус
git status

# Посмотреть историю
git log --oneline

# Отменить последний коммит (сохранив изменения)
git reset --soft HEAD~1
```

---

Готово! Ваш проект готов к публикации! 🎉


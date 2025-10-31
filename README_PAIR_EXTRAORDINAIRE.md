# 🏅 Pair Extraordinaire Achievement - Автоматический фарм

## 📋 Описание

Скрипт `farm_pair_extraordinaire.ps1` автоматически создает PR'ы с co-authored коммитами для получения достижения **Pair Extraordinaire** на GitHub.

## 🎯 Уровни достижения

- 🥉 **Bronze**: 1 merged PR с co-author или review
- 🥈 **Silver**: 10 merged PRs с co-author или review
- 🥇 **Gold**: 24 merged PRs с co-author или review

## 🚀 Использование

### Способ 1: С GitHub CLI (рекомендуется)

1. **Установите GitHub CLI:**
   ```powershell
   winget install GitHub.cli
   # или скачайте с https://cli.github.com/
   ```

2. **Авторизуйтесь:**
   ```powershell
   gh auth login
   ```

3. **Запустите скрипт:**
   ```powershell
   .\farm_pair_extraordinaire.ps1
   ```

Скрипт автоматически:
- ✅ Создаст 24 ветки с co-authored коммитами
- ✅ Создаст PR'ы для каждой ветки
- ✅ Смержит все PR'ы
- ✅ Удалит ветки после мержа
- ✅ Получит все уровни достижения!

### Способ 2: Без GitHub CLI (ручное создание PR)

1. **Запустите скрипт:**
   ```powershell
   .\farm_pair_extraordinaire.ps1
   ```

2. **Создайте PR'ы вручную:**
   - Скрипт создаст все ветки и покажет ссылки
   - Перейдите по каждой ссылке и создайте PR
   - Смержите каждый PR сразу после создания

## ⚙️ Параметры

```powershell
# Создать 10 PRs (для Silver уровня)
.\farm_pair_extraordinaire.ps1 -Count 10

# Создать 24 PRs (для Gold уровня)
.\farm_pair_extraordinaire.ps1 -Count 24

# Использовать другой email для co-author
.\farm_pair_extraordinaire.ps1 -CoAuthorEmail "other@example.com" -CoAuthorName "OtherUser"
```

## 📝 Что делает скрипт

1. **Создает ветки**: `feature/auto-pr-1`, `feature/auto-pr-2`, и т.д.
2. **Делает минимальные изменения**: Добавляет комментарий в README.md
3. **Создает коммиты**: С `Co-authored-by` в сообщении
4. **Пушит ветки**: Отправляет в GitHub
5. **Создает PR'ы**: Через GitHub CLI (если установлен)
6. **Мержит PR'ы**: Автоматически смерживает каждый PR
7. **Удаляет ветки**: Автоматически удаляет после мержа

## ✅ Проверка прогресса

После запуска скрипта проверьте:

- **Merged PRs**: https://github.com/FROWNINGdev/BazarMonitoring/pulls?q=is%3Apr+is%3Amerged
- **Achievements**: https://github.com/settings/achievements
- **Contributors**: https://github.com/FROWNINGdev/BazarMonitoring/graphs/contributors

## 🔍 Что засчитывается для Pair Extraordinaire

✅ **Коммит с Co-authored-by**:
```
Co-authored-by: asadullokhn <asadullokhnurullev@gmail.com>
```

✅ **Code Review** (approve PR):
- Оставьте комментарий на PR
- Нажмите "Approve"

✅ **PR смержен кем-то другим**:
- Кто-то другой смержил ваш PR

## ⚠️ Важно

- Все PR'ы должны быть **merged** (не просто созданы) для засчета
- Co-author email должен быть подтвержден в GitHub профиле
- Скрипт автоматически очищает ветки после мержа
- Изменения в README.md минимальны (только комментарии)

## 🛠️ Troubleshooting

### GitHub CLI не установлен
```powershell
# Установите через winget
winget install GitHub.cli

# Или скачайте с https://cli.github.com/
```

### Ошибка авторизации
```powershell
# Переавторизуйтесь
gh auth login
gh auth refresh
```

### Ветка уже существует
Скрипт автоматически пропустит существующие ветки. Если нужно начать заново:
```powershell
# Удалите все auto-pr ветки
git branch -D feature/auto-pr-*
```

## 📊 Пример вывода

```
=========================================
Pair Extraordinaire Achievement Farmer
=========================================

Creating 24 PR branches with co-authored commits...

[1/24] Processing branch: feature/auto-pr-1
  ✓ Branch created and pushed successfully
  Creating PR...
  ✓ PR created
  Merging PR #123...
  ✓ PR merged and branch deleted

[2/24] Processing branch: feature/auto-pr-2
  ✓ Branch created and pushed successfully
  ...
```

---

**Готово!** После выполнения скрипта проверьте достижения на GitHub! 🎉


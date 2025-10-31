# 👤 Настройка GitHub для отображения контрибьютора

## Для asadullokhn

Чтобы GitHub отображал вас как контрибьютора в репозитории, необходимо выполнить следующие шаги:

### Шаг 1: Добавить email в GitHub профиль

1. Зайдите на GitHub: https://github.com/settings/emails
2. Нажмите кнопку **"Add email address"**
3. Введите ваш email: **asadullokhnurullev@gmail.com**
4. Подтвердите email через письмо, которое придет на почту
5. Убедитесь, что email отмечен как **"Verified"** (подтвержден)

### Шаг 2: Убедитесь, что email виден публично (опционально)

1. В настройках emails: https://github.com/settings/emails
2. Убедитесь, что галочка **"Keep my email addresses private"** НЕ установлена
3. Или установите галочку **"Block command line pushes that expose my email"** в выключенное состояние

### Шаг 3: Проверка

После выполнения шагов:
1. Подождите 5-10 минут (GitHub обновляет данные)
2. Перейдите на: https://github.com/FROWNINGdev/bazarmonitoring/graphs/contributors
3. Вы должны увидеть себя в списке контрибьюторов!

### Альтернативный способ (если email не работает)

Если после добавления email вы все еще не видитесь как контрибьютор:

1. Создайте коммит под своим GitHub аккаунтом:
   ```bash
   git config user.name "asadullokhn"
   git config user.email "asadullokhnurullev@gmail.com"
   
   # Создайте небольшой коммит
   echo "# Contribution" >> CONTRIBUTORS.md
   git add CONTRIBUTORS.md
   git commit -m "docs: update contributors list"
   git push origin master
   ```

2. Или сделайте хотя бы один коммит через GitHub UI (Web Editor)

## Важно

- Email должен быть **точно такой же**, как в коммитах: `asadullokhnurullev@gmail.com`
- Email должен быть **подтвержден** (Verified)
- После добавления email подождите несколько минут для синхронизации

## Проверка статуса

После выполнения шагов проверьте:
- https://github.com/FROWNINGdev/bazarmonitoring/graphs/contributors
- Вы должны появиться в списке контрибьюторов
- Ваш аватар и имя должны отображаться

---

**Вопросы?** Создайте Issue в репозитории.


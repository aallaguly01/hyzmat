# telegram-auth Specification

## Purpose
Идентификация пользователя без ввода логина/ника: клиент берёт данные из Telegram Web Apps API, сервер проверяет подпись `initData` и ведёт таблицу пользователей. Также определяет, как строится ссылка «Написать автору», включая fallback для пользователей без `@username`.

## Requirements

### Requirement: Передача initData на сервер
Клиент SHALL отправлять в каждом запросе к API заголовок `Authorization: tma <WebApp.initData>` (сырая строка, без изменений).

#### Scenario: Запрос из Telegram
- **WHEN** приложение открыто в Telegram и `WebApp.initData` не пустая
- **THEN** каждый HTTP-запрос к `/api/*` содержит заголовок `Authorization: tma <initData>`

#### Scenario: Приложение открыто вне Telegram
- **WHEN** `window.Telegram?.WebApp?.initData` пустая или отсутствует, и приложение собрано не в dev-режиме
- **THEN** вместо интерфейса показывается экран «Откройте приложение в Telegram» со ссылкой на бота
- **AND** запросы к API не отправляются

#### Scenario: Dev-режим
- **WHEN** приложение запущено с `VITE_MOCK_TELEGRAM=true`
- **THEN** используется мок `WebApp` с тестовым пользователем и initData, подписанной `DEV_BOT_TOKEN`

### Requirement: Серверная валидация initData
Сервер MUST проверять подпись `initData` по алгоритму Telegram: `secret_key = HMAC_SHA256(key="WebAppData", msg=BOT_TOKEN)`, `hash == hex(HMAC_SHA256(key=secret_key, msg=data_check_string))`, где `data_check_string` — все поля кроме `hash`, отсортированные по ключу и соединённые `\n` в формате `key=value`. Сравнение хэша MUST быть constant-time.

#### Scenario: Валидная подпись
- **WHEN** запрос содержит initData с корректным `hash` и `auth_date` не старше `INIT_DATA_TTL` (по умолчанию 86400 с)
- **THEN** запрос проходит, в контексте запроса доступен `request.user = { id, username, firstName, lastName }`

#### Scenario: Отсутствует заголовок
- **WHEN** заголовок `Authorization` отсутствует или не начинается с `tma `
- **THEN** сервер отвечает `401` с кодом `UNAUTHORIZED`

#### Scenario: Неверная подпись
- **WHEN** хоть одно поле initData изменено или `hash` не совпадает
- **THEN** сервер отвечает `401` с кодом `INVALID_INIT_DATA`

#### Scenario: Просроченная initData
- **WHEN** `now - auth_date > INIT_DATA_TTL`
- **THEN** сервер отвечает `401` с кодом `INIT_DATA_EXPIRED`
- **AND** клиент показывает «Сессия устарела, перезапустите приложение»

#### Scenario: В initData нет пользователя
- **WHEN** подпись валидна, но поле `user` отсутствует или не парсится как JSON
- **THEN** сервер отвечает `401` с кодом `INVALID_INIT_DATA`

### Requirement: Синхронизация пользователя
Сервер SHALL выполнять upsert записи `users` по `telegram id` при каждом аутентифицированном запросе на запись и при `GET /api/me`, обновляя `username`, `first_name`, `last_name`.

#### Scenario: Первый вход
- **WHEN** пользователь с id `42` впервые вызывает `GET /api/me`
- **THEN** в `users` создаётся запись с id `42` и данными из initData
- **AND** ответ `200` содержит `{ id: "42", username, firstName, lastName }`

#### Scenario: Пользователь сменил username
- **WHEN** пользователь, ранее бывший `@old`, приходит с initData, где `username = "new"`
- **THEN** запись `users` обновляется на `new`
- **AND** все его заявки в ленте отдают контакт `https://t.me/new`

#### Scenario: Пользователь удалил username
- **WHEN** в initData у существующего пользователя нет `username`
- **THEN** `users.username` становится `NULL`

### Requirement: Построение контакта автора
Функция `buildContactLink(author)` из `packages/shared` SHALL возвращать `{ url, label, kind }`:
- при наличии `username` → `{ url: "https://t.me/<username>", label: "@<username>", kind: "username" }`;
- иначе → `{ url: "tg://user?id=<id>", label: "<firstName>", kind: "id" }`.

#### Scenario: Есть username
- **WHEN** `author = { id: "42", username: "ivan", firstName: "Иван" }`
- **THEN** результат `{ url: "https://t.me/ivan", label: "@ivan", kind: "username" }`

#### Scenario: Нет username
- **WHEN** `author = { id: "42", username: null, firstName: "Иван" }`
- **THEN** результат `{ url: "tg://user?id=42", label: "Иван", kind: "id" }`

#### Scenario: Открытие контакта из Mini App
- **WHEN** пользователь нажимает «Написать» и `kind = "username"`
- **THEN** вызывается `WebApp.openTelegramLink(url)`
- **WHEN** `kind = "id"`
- **THEN** вызывается `WebApp.openLink(url)`; если клиент не смог открыть ссылку (Telegram ограничивает `tg://user?id` настройками приватности), пользователю показывается `WebApp.showAlert` с текстом «У автора нет @username. Найдите его в Telegram по имени: <firstName>»

### Requirement: Отображение своего контакта в форме
Клиент SHALL отображать под формой создания/редактирования строку из `WebApp.initDataUnsafe.user` (только для отображения, не для авторизации).

#### Scenario: У пользователя есть username
- **WHEN** `initDataUnsafe.user.username = "ivan"`
- **THEN** внизу формы: «Ваш Telegram для связи: @ivan»

#### Scenario: У пользователя нет username
- **WHEN** `initDataUnsafe.user.username` отсутствует
- **THEN** внизу формы: «Ваш Telegram для связи: Иван»
- **AND** под ней подсказка цветом `--tg-theme-hint-color`: «Установите @username в настройках Telegram, чтобы с вами было проще связаться»

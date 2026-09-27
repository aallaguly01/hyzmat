# listings Specification

## Purpose
Бизнес-логика и REST-контракт заявок двух типов — «Почта» (MAIL) и «Перевод» (TRANSFER): публичная лента с фильтрами, управление своими заявками (создание, редактирование, удаление). Схема БД и zod-схемы — в [design.md](./design.md).

## API Overview
Базовый путь `/api`. Все эндпоинты требуют авторизации (см. `telegram-auth`).

| Метод | Путь | Описание | Успех |
|---|---|---|---|
| GET | `/api/me` | Текущий пользователь | 200 `User` |
| GET | `/api/listings` | Лента | 200 `ListingPage` |
| GET | `/api/me/listings` | Мои заявки | 200 `{ items: MyListing[] }` |
| GET | `/api/listings/:id` | Одна заявка (для формы редактирования) | 200 `Listing` |
| POST | `/api/listings` | Создать заявку | 201 `Listing` |
| PATCH | `/api/listings/:id` | Изменить свою заявку | 200 `Listing` |
| DELETE | `/api/listings/:id` | Удалить свою заявку | 204 |
| GET | `/api/health` | Health-check (без авторизации) | 200 `{ status: "ok" }` |

### Формат `Listing` (ответ)
```jsonc
// MAIL
{
  "id": "uuid",
  "type": "MAIL",
  "fromCity": "Ашхабад",
  "toCity": "Москва",
  "departureDate": "2026-10-15",
  "author": { "id": "42", "username": "ivan", "firstName": "Иван" },
  "contact": { "url": "https://t.me/ivan", "label": "@ivan", "kind": "username" },
  "isOwn": false,
  "createdAt": "2026-09-27T10:00:00.000Z",
  "updatedAt": "2026-09-27T10:00:00.000Z"
}
// TRANSFER
{
  "id": "uuid",
  "type": "TRANSFER",
  "fromCity": "Ашхабад",
  "toCity": "Стамбул",
  "amount": "1500.00",
  "currency": "USD",
  "conditions": "Комиссия 2%",
  "author": { ... }, "contact": { ... }, "isOwn": false,
  "createdAt": "...", "updatedAt": "..."
}
```
`MyListing` = `Listing` + `"isExpired": boolean`.
`ListingPage` = `{ "items": Listing[], "nextCursor": string | null }`.

## Requirements

### Requirement: Типы заявок
Система SHALL поддерживать ровно два типа заявок: `MAIL` и `TRANSFER`. Тип задаётся при создании и MUST NOT меняться после.

#### Scenario: Неизвестный тип
- **WHEN** `POST /api/listings` с `type: "TAXI"`
- **THEN** ответ `400` с кодом `VALIDATION_ERROR`, `details` указывает на поле `type`

### Requirement: Создание заявки «Почта»
Заявка MAIL SHALL содержать `fromCity` (строка 2–64 символа после trim), `toCity` (2–64), `departureDate` (`YYYY-MM-DD`, не раньше сегодняшнего дня UTC и не позже чем через 365 дней). Автор MUST определяться только из валидированной initData.

#### Scenario: Успешное создание
- **WHEN** `POST /api/listings` с `{ type: "MAIL", fromCity: " Ашхабад ", toCity: "Москва", departureDate: "<сегодня+10>" }`
- **THEN** ответ `201`, `fromCity = "Ашхабад"` (обрезаны пробелы), `author.id` = id из initData, `isOwn = true`

#### Scenario: Дата в прошлом
- **WHEN** `departureDate` раньше сегодняшнего дня
- **THEN** ответ `400` `VALIDATION_ERROR` с сообщением «Дата вылета не может быть в прошлом»

#### Scenario: Одинаковые города
- **WHEN** `fromCity` и `toCity` совпадают без учёта регистра и пробелов
- **THEN** ответ `400` `VALIDATION_ERROR` с сообщением «Города отправления и назначения должны различаться»

#### Scenario: Попытка подменить автора
- **WHEN** тело запроса содержит `authorId` или `author`
- **THEN** поле игнорируется (strip), автором становится пользователь из initData

### Requirement: Создание заявки «Перевод»
Заявка TRANSFER SHALL содержать `fromCity` (город, где отдают деньги, 2–64), `toCity` (город, где получают, 2–64), `amount` (число > 0 и ≤ 1 000 000, максимум 2 знака после запятой), опционально `conditions` (строка до 200 символов — условия/комиссия в свободной форме). Валюта MUST всегда быть `USD`; клиент её не передаёт.

#### Scenario: Успешное создание
- **WHEN** `POST /api/listings` с `{ type: "TRANSFER", fromCity: "Ашхабад", toCity: "Стамбул", amount: "1500", conditions: "2%" }`
- **THEN** ответ `201`, `amount = "1500.00"`, `currency = "USD"`

#### Scenario: Неположительная сумма
- **WHEN** `amount` = `0`, отрицательное или не число
- **THEN** ответ `400` `VALIDATION_ERROR` по полю `amount`

#### Scenario: Клиент передал валюту
- **WHEN** тело содержит `currency: "EUR"`
- **THEN** поле игнорируется, сохраняется `USD`

#### Scenario: Поля другого типа
- **WHEN** в заявке TRANSFER передан `departureDate`
- **THEN** поле игнорируется (discriminated union со strip)

### Requirement: Лимиты на создание
Система SHALL ограничивать пользователя: не более 5 заявок одновременно и не более 5 созданий в час.

#### Scenario: Превышен лимит активных заявок
- **WHEN** у пользователя уже 5 заявок и он создаёт ещё одну
- **THEN** ответ `409` с кодом `LISTING_LIMIT_REACHED`

#### Scenario: Превышен rate limit
- **WHEN** пользователь выполняет 6-й `POST /api/listings` за час
- **THEN** ответ `429` с кодом `RATE_LIMITED`

### Requirement: Лента
`GET /api/listings` SHALL возвращать заявки всех пользователей указанного типа. Параметры: `type` (обязателен, `MAIL|TRANSFER`), `city` (опционально, 1–64 символа), `cursor` (опционально, непрозрачная строка), `limit` (1–50, по умолчанию 20).

#### Scenario: Фильтр по типу
- **WHEN** `GET /api/listings?type=MAIL`
- **THEN** в `items` только заявки `MAIL`

#### Scenario: Тип не передан
- **WHEN** `GET /api/listings` без `type`
- **THEN** ответ `400` `VALIDATION_ERROR`

#### Scenario: Поиск по городу
- **WHEN** `GET /api/listings?type=TRANSFER&city=ашх`
- **THEN** возвращаются заявки, у которых `fromCity` ИЛИ `toCity` содержит подстроку «ашх» без учёта регистра (включая «Ашхабад»)

#### Scenario: Скрытие устаревших «Почт»
- **WHEN** в БД есть MAIL-заявка с `departureDate` вчера и с `departureDate` сегодня
- **THEN** в ленте присутствует только сегодняшняя

#### Scenario: Сортировка
- **WHEN** запрашивается лента `MAIL`
- **THEN** заявки отсортированы по `departureDate ASC`, затем `createdAt DESC`, затем `id`
- **WHEN** запрашивается лента `TRANSFER`
- **THEN** заявки отсортированы по `createdAt DESC`, затем `id`

#### Scenario: Пагинация
- **WHEN** подходящих заявок 25, `limit=20`
- **THEN** первая страница содержит 20 записей и `nextCursor != null`
- **AND** запрос с этим `cursor` возвращает оставшиеся 5 и `nextCursor = null`
- **AND** записи не дублируются между страницами

#### Scenario: Свои заявки в ленте
- **WHEN** в ленте есть заявка текущего пользователя
- **THEN** она присутствует с `isOwn = true`

### Requirement: Мои заявки
`GET /api/me/listings` SHALL возвращать все заявки текущего пользователя обоих типов, отсортированные по `createdAt DESC`, включая устаревшие, с флагом `isExpired`.

#### Scenario: Только свои
- **WHEN** в БД есть заявки пользователей A и B, запрос делает A
- **THEN** в ответе только заявки A

#### Scenario: Устаревшая заявка
- **WHEN** у пользователя MAIL-заявка с `departureDate` в прошлом
- **THEN** она возвращается с `isExpired = true`
- **AND** TRANSFER-заявки всегда имеют `isExpired = false`

### Requirement: Редактирование заявки
`PATCH /api/listings/:id` SHALL позволять автору частично изменить поля своего типа с теми же правилами валидации, что и при создании. `type` MUST NOT изменяться. Обновляется `updatedAt`.

#### Scenario: Успешное редактирование
- **WHEN** автор отправляет `PATCH` с `{ toCity: "Казань" }`
- **THEN** ответ `200`, `toCity = "Казань"`, остальные поля без изменений, `updatedAt` увеличился

#### Scenario: Попытка сменить тип
- **WHEN** `PATCH` с `{ type: "TRANSFER" }` для MAIL-заявки
- **THEN** ответ `400` с кодом `TYPE_IMMUTABLE`

#### Scenario: Чужая заявка
- **WHEN** пользователь B редактирует заявку пользователя A
- **THEN** ответ `403` с кодом `FORBIDDEN`, данные не изменены

#### Scenario: Продление устаревшей «Почты»
- **WHEN** автор меняет `departureDate` устаревшей заявки на будущую дату
- **THEN** заявка снова появляется в ленте, `isExpired = false`

#### Scenario: Несуществующая заявка
- **WHEN** `PATCH /api/listings/<несуществующий uuid>`
- **THEN** ответ `404` с кодом `NOT_FOUND`

### Requirement: Удаление заявки
`DELETE /api/listings/:id` SHALL безвозвратно удалять заявку автора.

#### Scenario: Успешное удаление
- **WHEN** автор удаляет свою заявку
- **THEN** ответ `204`; заявка отсутствует в ленте и в «Моих заявках»

#### Scenario: Чужая заявка
- **WHEN** пользователь B удаляет заявку пользователя A
- **THEN** ответ `403` `FORBIDDEN`, заявка не удалена

#### Scenario: Уже удалена
- **WHEN** заявка не существует
- **THEN** ответ `404` `NOT_FOUND`

#### Scenario: Некорректный id
- **WHEN** `:id` не является UUID
- **THEN** ответ `400` `VALIDATION_ERROR`

### Requirement: Единый формат ошибок
Все ошибки API SHALL возвращаться в формате `{ "error": { "code", "message", "details"? } }`; `message` — на русском, пригодно для показа пользователю.

#### Scenario: Ошибка валидации
- **WHEN** тело запроса не проходит zod-схему
- **THEN** ответ `400`, `error.code = "VALIDATION_ERROR"`, `error.details = [{ path: ["amount"], message: "..." }]`

#### Scenario: Непредвиденная ошибка
- **WHEN** в обработчике выбрасывается неожиданное исключение
- **THEN** ответ `500` `INTERNAL_ERROR` без стектрейса; ошибка залогирована

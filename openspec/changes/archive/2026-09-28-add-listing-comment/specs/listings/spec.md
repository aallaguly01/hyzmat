## ADDED Requirements

### Requirement: Комментарий к заявке
Заявки обоих типов SHALL поддерживать необязательное поле `comment` — строку до 300 символов в свободной форме (например, другой способ связи). Значение обрезается по краям; пустая строка равносильна отсутствию. В ответе `Listing` поле MUST присутствовать всегда: строка или `null`. В `PATCH` значение `null` или пустая строка очищает комментарий.

#### Scenario: Создание с комментарием
- **WHEN** `POST /api/listings` с `{ type: "MAIL", fromCity: "Ашхабад", toCity: "Москва", departureDate: "2026-10-15", comment: "  WhatsApp +99365000000  " }`
- **THEN** ответ `201`, `comment = "WhatsApp +99365000000"`

#### Scenario: Комментарий у «Перевода»
- **WHEN** `POST /api/listings` с заявкой TRANSFER и `comment: "Звоните после 18:00"`
- **THEN** ответ `201`, `comment = "Звоните после 18:00"`

#### Scenario: Без комментария
- **WHEN** `POST /api/listings` без `comment` или с `comment: "   "`
- **THEN** ответ `201`, `comment = null`

#### Scenario: Слишком длинный комментарий
- **WHEN** `POST /api/listings` с `comment` длиной 301 символ
- **THEN** ответ `400` с кодом `VALIDATION_ERROR`, `details` указывает на поле `comment`

#### Scenario: Изменение и очистка комментария
- **WHEN** автор отправляет `PATCH` с `{ comment: "IMO +99365000000" }`
- **THEN** ответ `200`, `comment = "IMO +99365000000"`, остальные поля без изменений
- **WHEN** затем `PATCH` с `{ comment: null }`
- **THEN** ответ `200`, `comment = null`

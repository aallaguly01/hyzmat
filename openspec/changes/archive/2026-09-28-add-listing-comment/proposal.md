# Change: Комментарий к заявке

## Why
Сейчас связаться с автором можно только через Telegram-ссылку. Часть пользователей хочет указать
другой способ связи (телефон, WhatsApp, IMO) или уточнить детали заявки, а для «Почты» свободного
текстового поля нет вовсе.

## What Changes
- Новое необязательное поле `comment` (до 300 символов) у заявок обоих типов — `MAIL` и `TRANSFER`.
- API: `comment` принимается в `POST`/`PATCH` и возвращается в `Listing` (`string | null`);
  в `PATCH` `null` или пустая строка очищает комментарий.
- БД: колонка `listings.comment VARCHAR(300) NULL` (миграция `0002_listing_comment`).
- Форма: поле «Комментарий» последним в обоих типах, placeholder «Можете указать способ связи».
- Карточка в ленте и в «Моих заявках» показывает комментарий, если он есть.

## Impact
- Affected specs: `listings`, `listing-form-ui`, `feed-ui`
- Affected code: `packages/shared` (константа, схемы, DTO), `apps/api` (Prisma, миграция, service, mapper),
  `apps/web` (форма, `useZodForm`, `ListingCard`)
- Обратная совместимость: поле необязательное, у существующих заявок `comment = null`

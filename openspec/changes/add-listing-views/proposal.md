# Change: Счётчик просмотров заявки

## Why
Автору не видно, смотрит ли кто-то его заявку, а зрителю — насколько она популярна. Нужен
привычный по Telegram-каналам «глазок» с числом просмотров на каждой карточке.

## What Changes
- Просмотр — показ карточки в ленте другому пользователю: карточка видна на ≥50% дольше 1 секунды.
  Каждое открытие приложения засчитывает заявку не больше одного раза; показы автору не считаются.
- API: `POST /api/listings/views` с `{ ids: uuid[] }` (1–50 id) — `204`; поле `viewCount: number`
  во всех ответах `Listing`. Счётчик не меняет `updatedAt`.
- БД: колонка `listings.view_count INTEGER NOT NULL DEFAULT 0` (миграция `0003_listing_view_count`).
- Карточка в ленте и в «Моих заявках» показывает «👁 1.2K» справа в мета-строке, в стиле Telegram.

## Impact
- Affected specs: `listings`, `feed-ui`
- Affected code: `packages/shared` (схема, DTO, `formatViews`), `apps/api` (Prisma, миграция, repo,
  service, routes, mapper), `apps/web` (`EyeIcon`, `ListingCard`, `viewTracker`, `FeedPage`)
- Обратная совместимость: у существующих заявок `viewCount = 0`

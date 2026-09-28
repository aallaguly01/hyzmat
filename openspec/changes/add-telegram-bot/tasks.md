## 1. Связь и оформление
- [x] 1.1 `GET /api/bot/ping` под `X-Bot-Key`, `GET /diag` в Worker
- [x] 1.2 `apps/bot-worker/setup.mjs`: описание, команды лички и групп, кнопка меню

## 2. Команды бота
- [x] 2.1 `resolveCityAlias`, `deeplink` в `packages/shared` + тесты
- [x] 2.2 `modules/bot`: `handleUpdate`, `POST /api/bot/update`, поиск через `repo.feed`
- [x] 2.3 Worker: прокси на сервер, запасной ответ
- [x] 2.4 Тесты: unit `bot.update`, `bot.routes`, `config`; integration `bot.int.test.ts`; Worker `node --test`

## 3. Ссылки на заявку
- [x] 3.1 `start_param` в типах и моках, `useStartParam`
- [x] 3.2 Подсветка заявки в ленте (`FeedFilter.highlight`), `ShareButton` в ленте
- [x] 3.3 Тесты `startParam.test.tsx`

## 4. Подписки
- [x] 4.1 Миграция `0004_bot_notifications`: `subscriptions`, `notifications`, `users.bot_blocked_at`, `listings.expiry_notified_at`
- [x] 4.2 API `GET/POST/DELETE /api/subscriptions`, лимит 10
- [x] 4.3 Web: «Следить» в ленте (`requestWriteAccess`), блок «Подписки» в «Моих заявках»

## 5. Уведомления
- [x] 5.1 Постановка: новая заявка по подписке, напоминание за день до выезда
- [x] 5.2 `POST /api/bot/outbox/claim`, `/ack`
- [x] 5.3 Worker `scheduled()`: claim → sendMessage → ack

## 6. Проверка
- [x] 6.1 `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- [x] 6.2 `openspec validate add-telegram-bot --strict`

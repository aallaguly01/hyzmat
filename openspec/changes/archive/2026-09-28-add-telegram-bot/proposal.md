# Change: Telegram-бот — команды, поиск в группах, ссылки на заявки, уведомления

## Why
Бот умел только приветствие на `/start`. Нужны: ответ на любое сообщение, поиск заявок прямо в
группах (`/pochta Балкан`), ссылки, открывающие конкретную заявку в Mini App, и уведомления
(новая заявка по подписке, истечение своей заявки).

VPS стоит в РФ: он и Telegram недоступны друг другу в обе стороны. Поэтому соединения всегда
открывает Cloudflare Worker (`apps/bot-worker`): Telegram → Worker → `https://<DOMAIN>/api/bot/*`
и Worker → `api.telegram.org`. Сервер сам никуда не ходит.

## What Changes
- Worker — тонкий прокси: проверяет `secret_token` Telegram, пересылает апдейт на
  `POST /api/bot/update` с ключом `X-Bot-Key`, возвращает ответ сервера телом webhook-ответа.
  Если сервер недоступен — в личке запасной ответ с кнопкой Mini App, в группе молчит.
- API `/api/bot/*` (ключ `BOT_API_KEY`, нужны `BOT_USERNAME`, `WEBAPP_URL`): `/start`, `/help`,
  подсказка на любой текст в личке; `/pochta <город>` и `/perevod <город>` в группах и личке —
  до 5 заявок ленты со ссылками `t.me/<бот>?startapp=l-<id>` и кнопкой «Все заявки».
- `packages/shared`: `resolveCityAlias` (латиница популярных городов), формат `startapp`
  (`l-<uuid>`, `f-<TYPE>[-<base64url города>]`).
- Web: разбор `start_param` (ссылка на заявку подсвечивает её в ленте), кнопка «Поделиться».
- Подписки и уведомления через outbox, который Worker забирает по cron.

## Impact
- Affected specs: `telegram-bot` (новая), `feed-ui`
- Affected code: `apps/bot-worker`, `apps/api` (`modules/bot`, config), `packages/shared`
  (`city`, `deeplink`), `apps/web` (`useStartParam`, `FeedPage`, `ShareButton`)
- Деплой: сначала сервер (`BOT_API_KEY`, `BOT_USERNAME` в `.env`), потом `wrangler deploy`

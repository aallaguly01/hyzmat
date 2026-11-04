# Hyzmat — P2P-маркетплейс услуг (Telegram Mini App)

[English](README.md) · **Русский**

Две услуги — **Почта** (передать посылку с попутчиком) и **Перевод** (наличные в одном городе → получение в другом, всегда в $).
Две вкладки — **Лента** и **Мои заявки**. Связь с автором — напрямую в Telegram.

Спецификация (OpenSpec): [`openspec/`](openspec/project.md). Каждый `Scenario` покрыт тестом.

## Стек

pnpm-монорепо · React 18 + Vite + TanStack Query · Fastify 5 + Prisma + PostgreSQL 16 · zod-контракт в `packages/shared` · Vitest, Testing Library, MSW, testcontainers, Playwright · ESLint/Prettier/Stylelint + lefthook + commitlint · GitHub Actions → GHCR → VPS (docker compose + Caddy).

```
apps/api        Fastify API (проверка initData, заявки, лимиты)
apps/web        Telegram Mini App
packages/shared zod-схемы, типы, форматтеры — общие для фронта и бэка
docker/         Dockerfile'ы, nginx, Caddy
openspec/       спецификации
```

## Быстрый старт (локально)

Нужны Node 22+, pnpm 10, Docker.

```bash
pnpm install
pnpm test                 # unit + интеграционные (Postgres поднимется в testcontainers) + компонентные

# Весь стек с мок-Telegram (без реального бота) → http://localhost:8080
docker compose -f docker-compose.e2e.yml up -d --build
pnpm --filter @hyzmat/web exec playwright install chromium
pnpm --filter @hyzmat/web e2e
```

Разработка с hot reload:

```bash
docker run -d --name hyzmat-pg -p 5432:5432 -e POSTGRES_USER=hyzmat -e POSTGRES_PASSWORD=hyzmat -e POSTGRES_DB=hyzmat postgres:16-alpine
cd apps/api && DATABASE_URL=postgresql://hyzmat:hyzmat@localhost:5432/hyzmat BOT_TOKEN=123456:DEV-TOKEN pnpm prisma migrate deploy
DATABASE_URL=... BOT_TOKEN=123456:DEV-TOKEN pnpm dev          # API на :3000
cd apps/web && VITE_MOCK_TELEGRAM=true VITE_DEV_BOT_TOKEN=123456:DEV-TOKEN pnpm dev   # :5173, /api проксируется
```

В мок-режиме пользователь задаётся параметром `?uid=123`. Мок попадает в сборку **только** при `VITE_MOCK_TELEGRAM=true`.

## Продакшен (VPS)

1. Создайте бота в @BotFather, затем `/newapp` (или Bot Settings → Menu Button) с URL `https://<DOMAIN>`.
2. На VPS: Docker, каталог `/opt/hyzmat` с `.env` по образцу [`.env.example`](.env.example) (`DOMAIN`, `BOT_TOKEN`, `POSTGRES_PASSWORD`), DNS домена → IP сервера.
3. Бот — Cloudflare Worker в [`apps/bot-worker`](apps/bot-worker): VPS в РФ и Telegram недоступны друг другу, поэтому webhook принимает Worker и пересылает апдейт на сервер (`/api/bot/update`, логика в `apps/api/src/modules/bot`); ответ сервера уходит в Telegram телом webhook-ответа. Команды: `/start`, `/help`, в группах и личке — `/pochta <город>`, `/perevod <город>`. На сервере нужны `BOT_API_KEY` и `BOT_USERNAME` в `.env`. Один раз, с машины с доступом к Telegram:
   ```sh
   cd apps/bot-worker
   npx wrangler@4 login
   npx wrangler@4 secret put WEBHOOK_SECRET   # случайная строка: openssl rand -hex 24
   npx wrangler@4 deploy                      # выведет адрес https://hyzmat-bot.<account>.workers.dev
   curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" -d url=<адрес Worker> -d secret_token=<WEBHOOK_SECRET>
   ```
   Тексты бота — в `apps/api/src/modules/bot/bot.update.ts` (деплоятся вместе с API); Worker передеплаивать нужно только при правке `apps/bot-worker`.
   Оформление (описание, команды, кнопка меню): `BOT_TOKEN=... node setup.mjs` в `apps/bot-worker`.
   Уведомления (новая заявка по подписке «🔔 Следить» в ленте, напоминание накануне выезда): сервер складывает их в очередь, Worker раз в минуту (cron) забирает и отправляет — нужен `npx wrangler@4 secret put BOT_TOKEN`.
   Связь Worker → сервер: `BOT_API_KEY` в `.env` сервера и `npx wrangler@4 secret put SERVER_API_KEY` с тем же значением; проверка — `curl https://hyzmat-bot.<account>.workers.dev/diag -H "x-diag-key: <WEBHOOK_SECRET>"`.
4. В GitHub: secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`; variable `BOT_USERNAME`; environment `production`.
5. Push в `main` → CI (lint, typecheck, тесты, e2e) → Deploy (образы в GHCR, `docker compose up -d` по SSH). Миграции применяются при старте API, TLS выпускает Caddy.

## Безопасность

- Сервер проверяет HMAC-подпись `initData` (и срок `auth_date`); `initDataUnsafe` используется только для отображения.
- Автор заявки всегда берётся из подписи, лимиты: 5 активных заявок и 5 созданий в час на пользователя.
- `BOT_TOKEN` только на сервере.

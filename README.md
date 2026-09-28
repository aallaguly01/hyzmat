# Hyzmat — P2P-маркетплейс услуг (Telegram Mini App)

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
2. На VPS: Docker, каталог `/opt/hyzmat` с `.env` по образцу [`.env.example`](.env.example) (`DOMAIN`, `BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, `POSTGRES_PASSWORD`), DNS домена → IP сервера. `BOT_WEBHOOK_SECRET` — случайная строка (`openssl rand -hex 32`): при старте API сам ставит webhook `https://<DOMAIN>/api/bot/webhook`, и на `/start` бот отвечает приветствием с кнопкой открытия Mini App.
3. В GitHub: secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`; variable `BOT_USERNAME`; environment `production`.
4. Push в `main` → CI (lint, typecheck, тесты, e2e) → Deploy (образы в GHCR, `docker compose up -d` по SSH). Миграции применяются при старте API, TLS выпускает Caddy.

## Безопасность

- Сервер проверяет HMAC-подпись `initData` (и срок `auth_date`); `initDataUnsafe` используется только для отображения.
- Автор заявки всегда берётся из подписи, лимиты: 5 активных заявок и 5 созданий в час на пользователя.
- `BOT_TOKEN` только на сервере.

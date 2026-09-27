# Project Context: Hyzmat — P2P-маркетплейс услуг (Telegram Mini App)

## Purpose
MVP Telegram Mini App, в котором пользователи публикуют и находят P2P-заявки двух типов:
- **Почта (MAIL)** — человек летит из города A в город B в определённую дату и может передать посылку/документы.
- **Перевод (TRANSFER)** — человек отдаёт наличные в городе A, а деньги получают в городе B (сумма всегда в USD).

Связь между пользователями — напрямую в Telegram (кнопка «Написать»). Платежей, рейтингов и внутреннего чата в MVP нет.

## Scope MVP
- В MVP входит: 2 вкладки (Лента, Мои заявки), 2 типа заявок, CRUD своих заявок, поиск по городу, авторизация через Telegram initData.
- В MVP НЕ входит: модерация, жалобы, уведомления бота, мультивалютность, геокодинг/справочник городов, i18n (только русский), админка.

## Tech Stack
| Слой | Технологии |
|---|---|
| Монорепо | pnpm workspaces, Node.js 22 LTS, TypeScript 5 (`strict: true`) |
| Frontend (`apps/web`) | React 18, Vite, официальный `telegram-web-app.js` + тонкие собственные хуки (`useMainButton`, `useBackButton`, …), TanStack Query v5, React Router v6, собственный хук формы `useZodForm` поверх zod-схем из `shared`, CSS Modules (без UI-китов, только CSS-переменные Telegram) |
| Backend (`apps/api`) | Fastify 5, `fastify-type-provider-zod`, `@fastify/rate-limit`, `@fastify/cors`, Prisma ORM, pino-логгер |
| БД | PostgreSQL 16 |
| Общий код (`packages/shared`) | zod-схемы (единый контракт API), TS-типы, чистые функции (`buildContactLink`, `normalizeCity`, `isExpired`, `formatAmount`) |
| Тесты | Vitest (unit + integration), `@testing-library/react` + jsdom (компоненты), testcontainers (Postgres в интеграционных), Playwright (E2E smoke), MSW (моки API на фронте) |
| Качество | ESLint 9 (flat config, `typescript-eslint`, `eslint-plugin-react-hooks`), Prettier, lefthook (pre-commit: lint + typecheck staged, commit-msg: commitlint conventional) |
| CI/CD | GitHub Actions: lint → typecheck → test (с сервисом postgres) → build → docker build/push (GHCR) → deploy по SSH (`docker compose pull && up -d`) |
| Инфраструктура | Docker + VPS: `docker-compose.yml` с сервисами `postgres`, `api`, `web` (nginx: статика + reverse proxy `/api` → api), TLS через Caddy/nginx + Let's Encrypt |

## Repository Layout
```
apps/
  web/                 # Telegram Mini App (Vite)
    src/app/           # роутер, провайдеры, TelegramProvider
    src/features/      # feed/, my-listings/, listing-form/
    src/shared/        # api-клиент, ui-примитивы, хуки telegram
  api/                 # Fastify
    src/plugins/       # auth (initData), prisma, errors, rate-limit
    src/modules/       # listings/, users/
    prisma/            # schema.prisma, migrations/
packages/
  shared/              # zod-схемы, типы, утилиты
docker/                # Dockerfile.api, Dockerfile.web, nginx.conf
openspec/              # спецификации (этот каталог)
.github/workflows/     # ci.yml, deploy.yml
docker-compose.yml
lefthook.yml
```

## Conventions
- Контракт API — только через zod-схемы из `packages/shared`; фронт и бэк импортируют одни и те же схемы.
- Идентификаторы в коде и БД — на английском; тексты UI — на русском.
- Даты: `departureDate` передаётся как `YYYY-MM-DD` (без времени и TZ). «Сегодня» считается в UTC на сервере; клиент может дополнительно передать `X-Timezone-Offset` — в MVP не используется.
- Денежные суммы передаются строкой-десятичным (`"1500.00"`) во избежание потерь float; хранятся `NUMERIC(12,2)`.
- Ошибки API — единый формат `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
- Коммиты — Conventional Commits. Ветки — `feat/*`, `fix/*`.

## Development Process
1. **SDD** — любое изменение поведения сначала описывается в `openspec/specs/**` (или в `openspec/changes/<id>/` для изменений после MVP).
2. **TDD** — каждый `#### Scenario` превращается минимум в один тест; тест пишется и падает до реализации.
3. **Реализация** — минимальный код, проходящий тесты; затем рефакторинг.

## Test Strategy
| Уровень | Что покрываем | Инструмент |
|---|---|---|
| Unit (shared) | zod-схемы, `normalizeCity`, `buildContactLink`, `isExpired`, `formatAmount` | Vitest |
| Unit (api) | `validateInitData` (подпись, срок, битые данные) | Vitest |
| Integration (api) | все эндпоинты через `app.inject()` против реального Postgres | Vitest + testcontainers |
| Component (web) | экраны Ленты, Моих заявок, формы; мок `window.Telegram.WebApp` + MSW | Vitest + Testing Library |
| E2E smoke | создать → увидеть в ленте → отредактировать → удалить | Playwright, мок initData, dev-режим |

Порог покрытия в CI: 80% строк для `packages/shared` и `apps/api`.

## Security
- Сервер НИКОГДА не доверяет `initDataUnsafe`; авторизация только по валидированной подписи `initData`.
- `BOT_TOKEN` хранится только на сервере (env/secret), во фронт-бандл не попадает.
- Rate limit на запись, ограничение длины всех строковых полей, CORS только для домена TMA.

## Glossary
- **Заявка (Listing)** — публикация пользователя типа MAIL или TRANSFER.
- **Автор (Author)** — пользователь Telegram, создавший заявку.
- **Лента (Feed)** — публичный список актуальных заявок всех пользователей.
- **initData** — подписанная строка, которую Telegram передаёт Mini App (`WebApp.initData`).

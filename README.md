# Hyzmat — P2P services marketplace (Telegram Mini App)

**English** · [Русский](README.ru.md)

A Telegram Mini App where people find each other for two kinds of favours between cities:

- **Mail** — someone is travelling from city A to city B and can carry a parcel or documents.
- **Transfer** — someone hands over cash in city A and the money is received in city B (always in USD).

Two tabs: **Feed** (browse, search by city, follow a city) and **My listings** (create, edit, delete).
Contact happens directly in Telegram, with no payments or in-app chat. A companion bot answers `/pochta <city>` and
`/perevod <city>` in groups and private chats, and sends notifications for followed cities and departure reminders.

> The UI and bot texts are in Russian. Code, identifiers and the database schema are in English.

## Architecture

```mermaid
flowchart LR
    subgraph TG["Telegram"]
        User(["User"])
        MiniApp["Mini App<br/>React 18 + Vite"]
        BotAPI["Bot API"]
    end

    subgraph CF["Cloudflare"]
        Worker["Bot Worker<br/>webhook proxy + cron"]
    end

    subgraph VPS["VPS (docker compose)"]
        Caddy["Caddy<br/>TLS"]
        Nginx["nginx<br/>static + /api proxy"]
        API["Fastify 5 API<br/>initData HMAC · zod · Prisma"]
        PG[("PostgreSQL 16")]
    end

    User --> MiniApp
    MiniApp -- "HTTPS + signed initData" --> Caddy --> Nginx --> API --> PG

    BotAPI -- "webhook (secret_token)" --> Worker
    Worker -- "POST /api/bot/update<br/>x-bot-key" --> API
    API -. "reply in webhook response body" .-> Worker -.-> BotAPI
    Worker -- "every minute:<br/>outbox/claim → sendMessage → outbox/ack" --> API
    Worker -- "sendMessage" --> BotAPI
```

**Why there is a Worker:** the VPS is hosted in Russia, where Telegram's servers and the VPS can't reach each other
directly. So the bot's webhook lands on a Cloudflare Worker, and **the Worker opens every connection**:

- **Incoming updates.** The Worker checks Telegram's `secret_token` and forwards the update to the server. The bot logic
  runs on the server, which returns a ready Bot API call (`{ method: 'sendMessage', … }`). The Worker sends that back to
  Telegram as the webhook response body, so the server never calls Telegram itself. If the server is down, users in
  private chats get a fallback message with an "Open app" button.
- **Outgoing notifications.** The server writes messages to an outbox table in Postgres. Once a minute a Cron Trigger runs
  the Worker, which _claims_ a batch, sends each message within Telegram's rate limit, and _acks_ the results. Messages
  that fail temporarily are retried later. Users who blocked the bot are marked and skipped from then on.

The Mini App itself only talks to the server. Every request carries Telegram's signed `initData`, and the server checks
the HMAC signature and `auth_date` freshness. `initDataUnsafe` is used for display only and never trusted.

## Tech stack

| Layer    | Tech                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces, Node 22, TypeScript (strict)                                                             |
| Web      | React 18, Vite, TanStack Query v5, React Router, CSS Modules on Telegram theme variables (light/dark)     |
| API      | Fastify 5, `fastify-type-provider-zod`, Prisma, PostgreSQL 16, pino                                       |
| Contract | `packages/shared`: zod schemas, types and formatters used by both web and API                             |
| Bot      | Cloudflare Worker (webhook proxy + cron delivery). Bot logic lives in the API                             |
| Tests    | Vitest, Testing Library + MSW, testcontainers (real Postgres), Playwright e2e smoke                       |
| Quality  | ESLint 9, Prettier, Stylelint, lefthook (pre-commit), commitlint (Conventional Commits)                   |
| CI/CD    | GitHub Actions: lint → typecheck → tests → e2e → images to GHCR → `docker compose up` on the VPS over SSH |

```
apps/api         Fastify API: initData auth, listings, subscriptions, bot logic, notification outbox
apps/web         Telegram Mini App
apps/bot-worker  Cloudflare Worker: webhook proxy and cron-based notification delivery
packages/shared  zod contract, types, pure helpers shared by web and API
docker/          Dockerfiles, nginx, Caddy
openspec/        specifications (source of truth for behaviour)
```

## AI-assisted workflow

This project was built together with an AI coding agent ([Claude Code](https://claude.com/claude-code)). Every commit
in the history is co-authored by it. The goal was to keep the agent fast _and_ controlled, so the process limits what
it's allowed to do:

1. **Prompt as a brief.** [`promt.md`](promt.md) is the original task: product requirements, required methodology
   (spec-driven + test-driven), and a rule that the agent must propose a stack and a spec and **wait for human approval**
   before writing any code.
2. **Spec first ([OpenSpec](https://github.com/Fission-AI/OpenSpec)).** Behaviour lives in [`openspec/specs`](openspec/specs):
   49 requirements and 135 `Scenario`s in Given/When/Then form. Changes after the MVP go through
   [`openspec/changes/<id>`](openspec/changes) (proposal → spec delta → task list). Once a change ships, it's archived
   and merged into the main specs.
3. **Tests from scenarios.** Each scenario becomes at least one test, written and seen to fail before the
   implementation. Integration tests run against a real Postgres in testcontainers instead of mocks, so the agent
   can't "pass" with a fake database.
4. **Guardrails the agent can't skip.** Strict TypeScript, ESLint/Stylelint/Prettier, lefthook pre-commit hooks,
   commitlint, and a CI pipeline that has to go green before deploy. The agent's output goes through the same gates as
   human code.
5. **Human in the loop.** The human approves the specs, reviews the diffs, decides on architecture (for example, routing
   the bot through a Worker because of network restrictions), and handles anything involving production secrets.

In practice, the specs and tests are what make AI-written code reviewable: you can check a diff against a scenario
instead of reading it cold.

## Getting started

Requires Node 22+, pnpm 10 and Docker.

```bash
pnpm install
pnpm test        # unit + integration (Postgres via testcontainers) + component tests

# Full stack with a mocked Telegram (no real bot needed) → http://localhost:8080
docker compose -f docker-compose.e2e.yml up -d --build
pnpm --filter @hyzmat/web exec playwright install chromium
pnpm --filter @hyzmat/web e2e
```

Dev mode with hot reload:

```bash
docker run -d --name hyzmat-pg -p 5432:5432 -e POSTGRES_USER=hyzmat -e POSTGRES_PASSWORD=hyzmat -e POSTGRES_DB=hyzmat postgres:16-alpine
cd apps/api && DATABASE_URL=postgresql://hyzmat:hyzmat@localhost:5432/hyzmat BOT_TOKEN=123456:DEV-TOKEN pnpm prisma migrate deploy
DATABASE_URL=... BOT_TOKEN=123456:DEV-TOKEN pnpm dev                                  # API on :3000
cd apps/web && VITE_MOCK_TELEGRAM=true VITE_DEV_BOT_TOKEN=123456:DEV-TOKEN pnpm dev   # :5173, /api is proxied
```

In mock mode the user is selected with `?uid=123`. The Telegram mock is included in the bundle **only** when
`VITE_MOCK_TELEGRAM=true`.

## Deployment

The production setup (VPS, Cloudflare Worker, GitHub secrets) is described step by step in
[README.ru.md](README.ru.md#продакшен-vps). In short: copy [`.env.example`](.env.example) to `.env` on the VPS. On every
push to `main`, CI builds images and rolls them out over SSH, the API applies migrations on start, and Caddy issues TLS
certificates. The Worker is deployed separately with `wrangler`.

## Security

- Authorization comes only from the HMAC-verified `initData`. The listing author is always taken from the signature.
- Rate limits: 5 active listings and 5 creations per hour per user. All string fields are length-limited.
- `BOT_TOKEN` stays on the server and the Worker and never goes into the frontend bundle. The Worker and the server
  authenticate each other with a shared key and compare secrets in constant time.

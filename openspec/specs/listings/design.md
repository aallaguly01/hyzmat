# listings — Technical Design

## Data Model

### ER
```
users 1 ──── * listings
```

### Prisma schema (`apps/api/prisma/schema.prisma`)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ListingType {
  MAIL
  TRANSFER
}

model User {
  id        BigInt    @id                     // Telegram user id
  username  String?   @db.VarChar(32)
  firstName String    @map("first_name") @db.VarChar(64)
  lastName  String?   @map("last_name")  @db.VarChar(64)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt      @map("updated_at")
  listings  Listing[]

  @@map("users")
}

model Listing {
  id            String      @id @default(uuid()) @db.Uuid
  type          ListingType
  authorId      BigInt      @map("author_id")
  author        User        @relation(fields: [authorId], references: [id], onDelete: Cascade)

  fromCity      String      @map("from_city")      @db.VarChar(64)
  toCity        String      @map("to_city")        @db.VarChar(64)
  fromCityNorm  String      @map("from_city_norm") @db.VarChar(64)
  toCityNorm    String      @map("to_city_norm")   @db.VarChar(64)

  // MAIL
  departureDate DateTime?   @map("departure_date") @db.Date

  // TRANSFER
  amount        Decimal?    @db.Decimal(12, 2)
  currency      String      @default("USD") @db.Char(3)
  conditions    String?     @db.VarChar(200)

  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt      @map("updated_at")

  @@index([type, createdAt(sort: Desc)])
  @@index([type, departureDate])
  @@index([authorId, createdAt(sort: Desc)])
  @@map("listings")
}
```

### Ограничения на уровне БД (raw SQL в миграции)
```sql
ALTER TABLE listings ADD CONSTRAINT listings_type_fields_chk CHECK (
  (type = 'MAIL'     AND departure_date IS NOT NULL AND amount IS NULL AND conditions IS NULL)
  OR
  (type = 'TRANSFER' AND departure_date IS NULL AND amount IS NOT NULL AND amount > 0)
);
ALTER TABLE listings ADD CONSTRAINT listings_currency_chk CHECK (currency = 'USD');

-- Поиск подстроки по городу
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX listings_from_city_norm_trgm ON listings USING gin (from_city_norm gin_trgm_ops);
CREATE INDEX listings_to_city_norm_trgm   ON listings USING gin (to_city_norm   gin_trgm_ops);
```

### Нормализация города
`normalizeCity(s) = s.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru").replaceAll("ё", "е")`.
`*_norm` заполняются сервисом при create/update. Поиск: `from_city_norm LIKE %q% OR to_city_norm LIKE %q%`, где `q = normalizeCity(city)` с экранированием `%` и `_`.

### Устаревание
`isExpired(listing, today) = listing.type === "MAIL" && listing.departureDate < today` (сравнение строк `YYYY-MM-DD`). `today` — UTC-дата сервера, передаётся в функцию явно (для детерминированных тестов через инжектируемые часы `clock.today()`).

## Shared zod-схемы (`packages/shared/src/schemas.ts`)
```ts
const City = z.string().trim().min(2, "Минимум 2 символа").max(64, "Максимум 64 символа");
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Amount = z.coerce.number().positive().max(1_000_000).multipleOf(0.01);

export const CreateMailInput = z.object({
  type: z.literal("MAIL"),
  fromCity: City,
  toCity: City,
  departureDate: IsoDate,        // + refine: >= today && <= today+365 (в фабрике схемы с clock)
});

export const CreateTransferInput = z.object({
  type: z.literal("TRANSFER"),
  fromCity: City,
  toCity: City,
  amount: Amount,
  conditions: z.string().trim().max(200).optional(),
});

export const CreateListingInput = z
  .discriminatedUnion("type", [CreateMailInput, CreateTransferInput])
  .refine(differentCities, { path: ["toCity"], message: "Города отправления и назначения должны различаться" });

export const UpdateMailInput = CreateMailInput.omit({ type: true }).partial();
export const UpdateTransferInput = CreateTransferInput.omit({ type: true }).partial();
// Сервер выбирает Update-схему по типу существующей заявки; наличие `type` в теле → TYPE_IMMUTABLE.

export const FeedQuery = z.object({
  type: z.enum(["MAIL", "TRANSFER"]),
  city: z.string().trim().min(1).max(64).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const Author = z.object({ id: z.string(), username: z.string().nullable(), firstName: z.string() });
export const Contact = z.object({ url: z.string(), label: z.string(), kind: z.enum(["username", "id"]) });
// Listing / MyListing / ListingPage — см. spec.md
```
Схемы с датой создаются фабрикой `makeSchemas(clock)`, чтобы фронт и бэк использовали одинаковые правила, а тесты — фиксированную дату.

## Пагинация
Keyset-курсор: `base64url(JSON.stringify([sortKey1, sortKey2, id]))`.
- MAIL: `(departure_date, created_at DESC, id)`.
- TRANSFER: `(created_at DESC, id)`.
Некорректный курсор → `400 VALIDATION_ERROR`.

## Коды ошибок
| HTTP | code | Когда |
|---|---|---|
| 400 | `VALIDATION_ERROR` | тело/query/params не прошли zod |
| 400 | `TYPE_IMMUTABLE` | попытка сменить `type` |
| 401 | `UNAUTHORIZED` | нет заголовка `Authorization: tma` |
| 401 | `INVALID_INIT_DATA` | неверная подпись / нет user |
| 401 | `INIT_DATA_EXPIRED` | `auth_date` старше TTL |
| 403 | `FORBIDDEN` | действие с чужой заявкой |
| 404 | `NOT_FOUND` | заявка не найдена |
| 409 | `LISTING_LIMIT_REACHED` | > 5 заявок у пользователя |
| 429 | `RATE_LIMITED` | > 5 созданий в час |
| 500 | `INTERNAL_ERROR` | прочее |

## Структура модуля API
```
apps/api/src/
  app.ts                    # buildApp({ prisma, clock, botToken }) — для inject-тестов
  plugins/auth.ts           # preHandler: validateInitData → request.user, upsert
  plugins/errors.ts         # setErrorHandler → единый формат
  modules/listings/
    listings.routes.ts
    listings.service.ts     # бизнес-правила (лимиты, владение, нормализация)
    listings.repo.ts        # Prisma-запросы, курсоры
    listings.mapper.ts      # DB → DTO (contact, isOwn, isExpired, amount toFixed(2))
  lib/telegram/validateInitData.ts
  lib/clock.ts
```

## Переменные окружения (api)
| Имя | Пример | Описание |
|---|---|---|
| `DATABASE_URL` | `postgresql://app:app@postgres:5432/hyzmat` | |
| `BOT_TOKEN` | `123:ABC` | токен бота для проверки initData |
| `INIT_DATA_TTL` | `86400` | секунд |
| `CORS_ORIGIN` | `https://hyzmat.example.com` | |
| `PORT` | `3000` | |

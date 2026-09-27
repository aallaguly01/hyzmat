-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('MAIL', 'TRANSFER');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGINT NOT NULL,
    "username" VARCHAR(32),
    "first_name" VARCHAR(64) NOT NULL,
    "last_name" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "type" "ListingType" NOT NULL,
    "author_id" BIGINT NOT NULL,
    "from_city" VARCHAR(64) NOT NULL,
    "to_city" VARCHAR(64) NOT NULL,
    "from_city_norm" VARCHAR(64) NOT NULL,
    "to_city_norm" VARCHAR(64) NOT NULL,
    "departure_date" DATE,
    "amount" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "conditions" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_type_created_at_idx" ON "listings"("type", "created_at" DESC);
CREATE INDEX "listings_type_departure_date_idx" ON "listings"("type", "departure_date");
CREATE INDEX "listings_author_id_created_at_idx" ON "listings"("author_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Инварианты полей по типу заявки
ALTER TABLE "listings" ADD CONSTRAINT "listings_type_fields_chk" CHECK (
  ("type" = 'MAIL' AND "departure_date" IS NOT NULL AND "amount" IS NULL AND "conditions" IS NULL)
  OR
  ("type" = 'TRANSFER' AND "departure_date" IS NULL AND "amount" IS NOT NULL AND "amount" > 0)
);
ALTER TABLE "listings" ADD CONSTRAINT "listings_currency_chk" CHECK ("currency" = 'USD');

-- Поиск подстроки по городу
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "listings_from_city_norm_trgm" ON "listings" USING gin ("from_city_norm" gin_trgm_ops);
CREATE INDEX "listings_to_city_norm_trgm" ON "listings" USING gin ("to_city_norm" gin_trgm_ops);

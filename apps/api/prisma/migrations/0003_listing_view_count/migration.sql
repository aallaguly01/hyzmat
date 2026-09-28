-- Счётчик показов заявки в ленте другим пользователям
ALTER TABLE "listings" ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;

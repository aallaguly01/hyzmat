## 1. Тесты
- [x] 1.1 `packages/shared` `format.test.ts`: `formatViews`
- [x] 1.2 `apps/api` `listings.int.test.ts`: сценарии требования «Просмотры заявки»
- [x] 1.3 `apps/web` `FeedPage.test.tsx`: сценарии «Просмотры»

## 2. Реализация
- [x] 2.1 `RecordViewsBody`, `MAX_VIEWS_BATCH`, `ListingBase.viewCount`, `formatViews` в `packages/shared`
- [x] 2.2 Prisma: поле `viewCount`, миграция `0003_listing_view_count`
- [x] 2.3 API: `POST /listings/views`, repo `recordViews` (сырой SQL, без `updatedAt`), mapper
- [x] 2.4 Web: `EyeIcon`, счётчик в `ListingCard`, `viewTracker` в ленте, фикстуры и MSW

## 3. Проверка
- [x] 3.1 `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- [x] 3.2 `openspec validate add-listing-views --strict`

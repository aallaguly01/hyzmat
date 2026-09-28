## 1. Тесты (пишутся до реализации и падают)
- [x] 1.1 `packages/shared` `schemas.test.ts`: `comment` в Create/Update обоих типов — trim, пустое → нет, > 300 → ошибка, `null` в Update
- [x] 1.2 `apps/api` `listings.int.test.ts`: сценарии требования «Комментарий к заявке»
- [x] 1.3 `apps/web` `ListingFormPage.test.tsx`: сценарии «Поле «Комментарий»»
- [x] 1.4 `apps/web` `FeedPage.test.tsx`: сценарии «Комментарий в карточке»

## 2. Реализация
- [x] 2.1 `COMMENT_MAX`, схемы и `ListingBase.comment` в `packages/shared`
- [x] 2.2 Prisma: поле `comment`, миграция `0002_listing_comment`
- [x] 2.3 API: service create/update, mapper
- [x] 2.4 Web: поле-textarea в форме, `useZodForm` для textarea, комментарий в `ListingCard`, фикстуры

## 3. Проверка
- [x] 3.1 `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- [x] 3.2 Сборка web и `size` в пределах лимита
- [x] 3.3 `openspec validate add-listing-comment --strict`

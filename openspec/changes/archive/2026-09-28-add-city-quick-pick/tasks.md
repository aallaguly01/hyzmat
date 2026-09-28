## 1. Тесты (пишутся до реализации и падают)
- [x] 1.1 `packages/shared`: `POPULAR_CITIES` — 7 городов в заданном порядке, каждый проходит схему города, нормализованные значения уникальны
- [x] 1.2 `apps/web` `ListingFormPage.test.tsx`: по тесту на каждый сценарий требования «Быстрый выбор города»

## 2. Реализация
- [x] 2.1 `POPULAR_CITIES` в `packages/shared/src/constants.ts`
- [x] 2.2 `useZodForm`: `setValue(name, value)` — установка значения с пометкой поля как touched
- [x] 2.3 Компонент `CityChips` и стили чипсов в `Controls.module.css`
- [x] 2.4 `ListingFormPage`: чипсы под полями городов, неактивный чипс города из соседнего поля

## 3. Проверка
- [x] 3.1 `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`
- [x] 3.2 Сборка web и `size` в пределах лимита
- [x] 3.3 `openspec validate add-city-quick-pick --strict`

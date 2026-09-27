# theming Specification

## Purpose
Нативный вид и поведение Mini App: цвета из темы Telegram (светлая/тёмная автоматически), инициализация WebApp, безопасные зоны, лёгкий и быстрый UI.

## Design Tokens
Все цвета в CSS MUST браться только из переменных Telegram с fallback на светлую тему (для dev вне Telegram). Токены объявляются в `apps/web/src/shared/ui/tokens.css`:

| Токен приложения | Переменная Telegram | Fallback |
|---|---|---|
| `--c-bg` | `--tg-theme-bg-color` | `#ffffff` |
| `--c-secondary-bg` | `--tg-theme-secondary-bg-color` | `#f1f1f4` |
| `--c-section-bg` | `--tg-theme-section-bg-color` | `#ffffff` |
| `--c-text` | `--tg-theme-text-color` | `#000000` |
| `--c-hint` | `--tg-theme-hint-color` | `#8e8e93` |
| `--c-link` | `--tg-theme-link-color` | `#2481cc` |
| `--c-accent` | `--tg-theme-button-color` | `#2481cc` |
| `--c-accent-text` | `--tg-theme-button-text-color` | `#ffffff` |
| `--c-accent-soft` | `--tg-theme-accent-text-color` | `#2481cc` |
| `--c-header-bg` | `--tg-theme-header-bg-color` | `#ffffff` |
| `--c-section-separator` | `--tg-theme-section-separator-color` | `#e5e5ea` |
| `--c-destructive` | `--tg-theme-destructive-text-color` | `#e53935` |
| `--c-subtitle` | `--tg-theme-subtitle-text-color` | `#8e8e93` |

Пример: `--c-bg: var(--tg-theme-bg-color, #ffffff);`

## Requirements

### Requirement: Цвета только из темы Telegram
Компоненты SHALL использовать только токены `--c-*`; захардкоженные цвета в компонентах MUST NOT использоваться (проверяется stylelint-правилом `color-no-hex` для `*.module.css`, исключение — `tokens.css`).

#### Scenario: Тёмная тема
- **WHEN** в Telegram включена тёмная тема
- **THEN** фон приложения равен `themeParams.bg_color`, текст — `themeParams.text_color`, без перезагрузки и дополнительной логики

#### Scenario: Смена темы на лету
- **WHEN** пользователь меняет тему Telegram при открытом приложении (событие `themeChanged`)
- **THEN** цвета интерфейса обновляются без перезагрузки
- **AND** `WebApp.setHeaderColor` и `WebApp.setBackgroundColor` повторно выставляются в `bg_color`

#### Scenario: Запуск вне Telegram (dev)
- **WHEN** переменные `--tg-theme-*` не заданы
- **THEN** используются fallback-значения светлой темы

### Requirement: Инициализация WebApp
При старте приложение SHALL вызывать `WebApp.ready()`, `WebApp.expand()`, выставлять цвета заголовка и фона, и отключать вертикальные свайпы закрытия на экранах формы (`disableVerticalSwipes`, если поддерживается версией клиента).

#### Scenario: Старт
- **WHEN** приложение смонтировано
- **THEN** вызваны `ready()` и `expand()` ровно по одному разу

#### Scenario: Старая версия клиента
- **WHEN** `WebApp.isVersionAtLeast("7.7")` = false
- **THEN** `disableVerticalSwipes` не вызывается и ошибок в консоли нет

### Requirement: Безопасные зоны и вёрстка
Разметка SHALL учитывать `env(safe-area-inset-*)` и `--tg-viewport-stable-height`; `BottomTabs` и FAB MUST NOT перекрываться системными элементами.

#### Scenario: iPhone с «чёлкой»
- **WHEN** приложение открыто на устройстве с ненулевым `safe-area-inset-bottom`
- **THEN** `BottomTabs` имеет нижний отступ `env(safe-area-inset-bottom)`

#### Scenario: Открытие клавиатуры
- **WHEN** на форме открыта экранная клавиатура
- **THEN** активное поле остаётся видимым (прокрутка к фокусу), `BottomTabs` на форме не отображаются

### Requirement: Производительность
Приложение SHALL быть лёгким: initial JS бандл (gzip) ≤ 150 KB, экраны формы загружаются лениво (`React.lazy`), шрифты системные (`-apple-system, system-ui, Roboto, sans-serif`), без UI-китов и иконочных шрифтов (иконки — inline SVG).

#### Scenario: Проверка размера бандла в CI
- **WHEN** выполняется `pnpm --filter web build` в CI
- **THEN** шаг `size-limit` падает, если initial chunk > 150 KB gzip

#### Scenario: Быстрое взаимодействие
- **WHEN** пользователь нажимает на интерактивный элемент
- **THEN** визуальный отклик (`:active` состояние) появляется без задержки; нет `300ms tap delay` (`touch-action: manipulation`)

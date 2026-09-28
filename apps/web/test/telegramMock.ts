import { vi } from 'vitest';
import type { TelegramWebApp, TelegramWebAppUser } from '../src/shared/telegram/types';

function createButton() {
  const handlers = new Set<() => void>();
  const btn = {
    text: '',
    isVisible: false,
    isActive: true,
    isProgressVisible: false,
    setText: vi.fn((t: string) => ((btn.text = t), btn)),
    show: vi.fn(() => ((btn.isVisible = true), btn)),
    hide: vi.fn(() => ((btn.isVisible = false), btn)),
    enable: vi.fn(() => ((btn.isActive = true), btn)),
    disable: vi.fn(() => ((btn.isActive = false), btn)),
    showProgress: vi.fn(() => ((btn.isProgressVisible = true), btn)),
    hideProgress: vi.fn(() => ((btn.isProgressVisible = false), btn)),
    setParams: vi.fn(() => btn),
    onClick: vi.fn((cb: () => void) => (handlers.add(cb), btn)),
    offClick: vi.fn((cb: () => void) => (handlers.delete(cb), btn)),
    /** Имитация нажатия пользователем (Telegram не вызывает обработчик у неактивной кнопки). */
    click: () => {
      if (!btn.isVisible || !btn.isActive) return;
      handlers.forEach((h) => h());
    },
    handlerCount: () => handlers.size,
  };
  return btn;
}

export function createTelegramMock(
  opts: { user?: TelegramWebAppUser; initData?: string; startParam?: string } = {},
) {
  const user = opts.user ?? { id: 1001, first_name: 'Алиса', username: 'alice' };
  const themeHandlers = new Set<() => void>();
  const confirmAnswers: boolean[] = [];
  let writeAccess = true;

  const MainButton = createButton();
  const BackButton = createButton();

  const wa = {
    initData: opts.initData ?? 'query_id=test&user=%7B%7D&auth_date=1&hash=abc',
    initDataUnsafe: { user, start_param: opts.startParam },
    version: '8.0',
    colorScheme: 'light' as const,
    themeParams: {},
    MainButton,
    BackButton,
    HapticFeedback: {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
      selectionChanged: vi.fn(),
    },
    ready: vi.fn(),
    expand: vi.fn(),
    isVersionAtLeast: vi.fn((v: string) => Number(v) <= 8),
    setHeaderColor: vi.fn(),
    setBackgroundColor: vi.fn(),
    disableVerticalSwipes: vi.fn(),
    enableVerticalSwipes: vi.fn(),
    openLink: vi.fn(),
    openTelegramLink: vi.fn(),
    showAlert: vi.fn((_m: string, cb?: () => void) => cb?.()),
    showConfirm: vi.fn((_m: string, cb?: (ok: boolean) => void) =>
      cb?.(confirmAnswers.length ? confirmAnswers.shift()! : true),
    ),
    onEvent: vi.fn((_e: string, cb: () => void) => themeHandlers.add(cb)),
    offEvent: vi.fn((_e: string, cb: () => void) => themeHandlers.delete(cb)),
    requestWriteAccess: vi.fn((cb?: (granted: boolean) => void) => cb?.(writeAccess)),
    // helpers
    denyWriteAccess: () => {
      writeAccess = false;
    },
    emitThemeChanged: () => themeHandlers.forEach((h) => h()),
    answerConfirm: (ok: boolean) => confirmAnswers.push(ok),
  };
  return wa satisfies TelegramWebApp;
}

export type TelegramMock = ReturnType<typeof createTelegramMock>;

export function installTelegram(mock: TelegramMock | undefined = createTelegramMock()) {
  window.Telegram = mock ? { WebApp: mock } : undefined;
  return mock;
}

import type { Contact } from '@hyzmat/shared';
import type { TelegramWebApp } from './types';

export function getWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/** WebApp гарантированно есть: вызывается только внутри TelegramGate. */
export function webApp(): TelegramWebApp {
  const wa = getWebApp();
  if (!wa) throw new Error('Telegram WebApp недоступен');
  return wa;
}

export const haptic = {
  success: () => getWebApp()?.HapticFeedback.notificationOccurred('success'),
  error: () => getWebApp()?.HapticFeedback.notificationOccurred('error'),
  selection: () => getWebApp()?.HapticFeedback.selectionChanged(),
};

export function showAlert(message: string): Promise<void> {
  return new Promise((resolve) => webApp().showAlert(message, () => resolve()));
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => webApp().showConfirm(message, (ok) => resolve(!!ok)));
}

/** Открывает чат с автором: t.me — нативно, tg://user?id — best effort с подсказкой. */
export function openContact(contact: Contact): void {
  const wa = webApp();
  if (contact.kind === 'username') {
    wa.openTelegramLink(contact.url);
    return;
  }
  try {
    wa.openLink(contact.url);
  } catch {
    void showAlert(`У автора нет @username. Найдите его в Telegram по имени: ${contact.label}`);
  }
}

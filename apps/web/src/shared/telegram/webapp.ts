import {
  formatAmount,
  formatDate,
  listingStartParam,
  type Contact,
  type ListingDto,
} from '@hyzmat/shared';
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

/** Username бота без @; без него ссылки t.me/<бот>?startapp=… не построить. */
export function botUsername(): string | undefined {
  return import.meta.env.VITE_BOT_USERNAME || undefined;
}

export function listingLink(id: string): string | undefined {
  const bot = botUsername();
  return bot ? `https://t.me/${bot}?startapp=${listingStartParam(id)}` : undefined;
}

/** Нативный диалог «Поделиться» Telegram со ссылкой, открывающей заявку в Mini App. */
export function shareListing(listing: ListingDto): void {
  const url = listingLink(listing.id);
  if (!url) return;
  const route = `${listing.fromCity} → ${listing.toCity}`;
  const text =
    listing.type === 'MAIL'
      ? `📦 Почта: ${route}, ${formatDate(listing.departureDate)}`
      : `💸 Перевод: ${route}, ${formatAmount(listing.amount)}`;
  const params = new URLSearchParams({ url, text });
  webApp().openTelegramLink(`https://t.me/share/url?${params}`);
}

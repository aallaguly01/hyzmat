import { formatAmount, formatDate, type ListingDto } from '@hyzmat/shared';

export type Button = { text: string; url: string } | { text: string; web_app: { url: string } };

export interface InlineKeyboard {
  inline_keyboard: Button[][];
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Ссылка, открывающая Mini App бота; `param` — start_param (см. `@hyzmat/shared` deeplink). */
export const appLink = (botUsername: string, param?: string) =>
  `https://t.me/${botUsername}?startapp${param ? `=${param}` : ''}`;

/** «Москва → Балкан», экранировано для parse_mode HTML. */
export const routeHtml = (l: Pick<ListingDto, 'fromCity' | 'toCity'>) =>
  escapeHtml(`${l.fromCity} → ${l.toCity}`);

/** Дата выезда для почты, сумма для перевода. */
export const listingDetail = (l: ListingDto) =>
  l.type === 'MAIL' ? formatDate(l.departureDate) : formatAmount(l.amount);

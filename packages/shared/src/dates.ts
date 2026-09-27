import type { ListingType } from './constants';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Календарная дата в UTC в формате YYYY-MM-DD. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return todayUtc(d);
}

export function isExpired(
  listing: { type: ListingType; departureDate?: string | null },
  today: string,
): boolean {
  return listing.type === 'MAIL' && !!listing.departureDate && listing.departureDate < today;
}

/** «2026-10-15» → «15 окт 2026». */
export function formatDate(isoDate: string): string {
  const m = ISO_DATE.exec(isoDate);
  if (!m) return isoDate;
  const [, y, mo, d] = m;
  return `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}`;
}

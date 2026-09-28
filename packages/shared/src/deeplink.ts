import { LISTING_TYPES, type ListingType } from './constants';

/**
 * Параметр `startapp` для ссылок `https://t.me/<бот>?startapp=<param>`.
 * Telegram допускает только [A-Za-z0-9_-] и до 64 символов, поэтому город кодируется в base64url.
 */
export type StartParam =
  { kind: 'listing'; id: string } | { kind: 'feed'; type: ListingType; city?: string };

const MAX_LEN = 64;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function utf8Bytes(s: string): number[] {
  const bytes: number[] = [];
  for (const part of encodeURIComponent(s).split(/(%[0-9A-F]{2})/)) {
    if (part.startsWith('%')) bytes.push(parseInt(part.slice(1), 16));
    else for (const ch of part) bytes.push(ch.charCodeAt(0));
  }
  return bytes;
}

function toBase64Url(s: string): string {
  const b = utf8Bytes(s);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    const chars = [18, 12, 6, 0].map((shift) => B64[(n >> shift) & 63]);
    out += chars.slice(0, Math.min(4, Math.ceil(((b.length - i) * 8) / 6))).join('');
  }
  return out;
}

function fromBase64Url(s: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const chunk = s.slice(i, i + 4);
    let n = 0;
    for (let j = 0; j < 4; j++) n = (n << 6) | (j < chunk.length ? B64.indexOf(chunk[j]!) : 0);
    // из k символов base64 получается k − 1 байт (4 → 3, 3 → 2, 2 → 1)
    bytes.push(...[(n >> 16) & 255, (n >> 8) & 255, n & 255].slice(0, chunk.length - 1));
  }
  try {
    return decodeURIComponent(bytes.map((x) => `%${x.toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return null;
  }
}

export function listingStartParam(id: string): string {
  return `l-${id}`;
}

/** Если город не влезает в 64 символа, ссылка ведёт на ленту без фильтра. */
export function feedStartParam(type: ListingType, city?: string): string {
  const base = `f-${type}`;
  if (!city?.trim()) return base;
  const withCity = `${base}-${toBase64Url(city.trim())}`;
  return withCity.length <= MAX_LEN ? withCity : base;
}

export function parseStartParam(param: string | undefined | null): StartParam | null {
  if (!param || param.length > MAX_LEN) return null;
  if (param.startsWith('l-')) {
    const id = param.slice(2);
    return UUID.test(id) ? { kind: 'listing', id } : null;
  }
  const m = /^f-([A-Z]+)(?:-([A-Za-z0-9_-]+))?$/.exec(param);
  if (!m || !(LISTING_TYPES as readonly string[]).includes(m[1]!)) return null;
  const type = m[1] as ListingType;
  if (!m[2]) return { kind: 'feed', type };
  const city = fromBase64Url(m[2]);
  return city ? { kind: 'feed', type, city } : { kind: 'feed', type };
}

export const LISTING_TYPES = ['MAIL', 'TRANSFER'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const CURRENCY = 'USD';

export const MAX_ACTIVE_LISTINGS = 5;
export const MAX_CREATES_PER_HOUR = 5;
export const MAX_DAYS_AHEAD = 365;

export const CITY_MIN = 2;
export const CITY_MAX = 64;
/** Подсказки для быстрого выбора в форме; свой город по-прежнему вводится вручную. */
export const POPULAR_CITIES = [
  'Балкан',
  'Ашхабад',
  'Мары',
  'Лебап',
  'Дашогуз',
  'Казань',
  'Москва',
] as const;
export const CONDITIONS_MAX = 200;
export const COMMENT_MAX = 300;
export const AMOUNT_MAX = 1_000_000;

export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'TYPE_IMMUTABLE',
  'UNAUTHORIZED',
  'INVALID_INIT_DATA',
  'INIT_DATA_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'LISTING_LIMIT_REACHED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

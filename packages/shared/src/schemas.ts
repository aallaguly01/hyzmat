import { z } from 'zod';
import { normalizeCity } from './city';
import {
  AMOUNT_MAX,
  CITY_MAX,
  CITY_MIN,
  COMMENT_MAX,
  CONDITIONS_MAX,
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
  LISTING_TYPES,
  MAX_DAYS_AHEAD,
} from './constants';
import { addDays, isValidIsoDate } from './dates';

export interface Clock {
  /** Сегодняшняя дата (UTC) в формате YYYY-MM-DD. */
  today: () => string;
}

const REQUIRED = 'Обязательное поле';

const City = z
  .string({ required_error: REQUIRED, invalid_type_error: REQUIRED })
  .trim()
  .min(CITY_MIN, `Минимум ${CITY_MIN} символа`)
  .max(CITY_MAX, `Максимум ${CITY_MAX} символа`);

const Amount = z
  .union([z.string(), z.number()], { errorMap: () => ({ message: 'Укажите сумму' }) })
  .transform((value, ctx) => {
    const raw = String(value).trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({ code: 'custom', message: 'Введите сумму, например 1500 или 99.50' });
      return z.NEVER;
    }
    const n = Number(raw);
    if (n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Сумма должна быть больше 0' });
      return z.NEVER;
    }
    if (n > AMOUNT_MAX) {
      ctx.addIssue({ code: 'custom', message: 'Максимум 1 000 000 $' });
      return z.NEVER;
    }
    return n.toFixed(2);
  });

const ConditionsText = z.string().trim().max(CONDITIONS_MAX, `Максимум ${CONDITIONS_MAX} символов`);
const CommentText = z.string().trim().max(COMMENT_MAX, `Максимум ${COMMENT_MAX} символов`);

function departureDate(clock: Clock) {
  return z
    .string({ required_error: REQUIRED, invalid_type_error: REQUIRED })
    .superRefine((v, ctx) => {
      if (!isValidIsoDate(v)) {
        ctx.addIssue({ code: 'custom', message: 'Некорректная дата' });
        return;
      }
      const today = clock.today();
      if (v < today) {
        ctx.addIssue({ code: 'custom', message: 'Дата вылета не может быть в прошлом' });
      } else if (v > addDays(today, MAX_DAYS_AHEAD)) {
        ctx.addIssue({ code: 'custom', message: 'Дата вылета — не позже чем через год' });
      }
    });
}

function differentCities(v: { fromCity?: string; toCity?: string }, ctx: z.RefinementCtx): void {
  if (v.fromCity && v.toCity && normalizeCity(v.fromCity) === normalizeCity(v.toCity)) {
    ctx.addIssue({
      code: 'custom',
      path: ['toCity'],
      message: 'Города отправления и назначения должны различаться',
    });
  }
}

const emptyToUndefined = (v: string | undefined) => (v ? v : undefined);
const emptyToNull = (v: string | null | undefined) => (v === undefined ? undefined : v || null);

const comment = CommentText.optional().transform(emptyToUndefined);
const commentPatch = CommentText.nullable().optional().transform(emptyToNull);

export function makeSchemas(clock: Clock) {
  const MailFields = z.object({
    fromCity: City,
    toCity: City,
    departureDate: departureDate(clock),
    comment,
  });

  const TransferFields = z.object({
    fromCity: City,
    toCity: City,
    amount: Amount,
    conditions: ConditionsText.optional().transform(emptyToUndefined),
    comment,
  });

  const CreateMailInput = MailFields.extend({ type: z.literal('MAIL') });
  const CreateTransferInput = TransferFields.extend({ type: z.literal('TRANSFER') });

  const CreateListingInput = z
    .discriminatedUnion('type', [CreateMailInput, CreateTransferInput], {
      errorMap: () => ({ message: 'Выберите тип заявки' }),
    })
    .superRefine(differentCities);

  const UpdateMailInput = MailFields.extend({ comment: commentPatch }).partial();
  const UpdateTransferInput = TransferFields.extend({
    conditions: ConditionsText.nullable().optional().transform(emptyToNull),
    comment: commentPatch,
  }).partial();

  const FeedQuery = z.object({
    type: z.enum(LISTING_TYPES, { errorMap: () => ({ message: 'Укажите тип заявки' }) }),
    city: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().trim().max(CITY_MAX).optional(),
    ),
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(FEED_MAX_LIMIT).default(FEED_DEFAULT_LIMIT),
  });

  return {
    MailFields,
    TransferFields,
    CreateMailInput,
    CreateTransferInput,
    CreateListingInput,
    UpdateMailInput,
    UpdateTransferInput,
    FeedQuery,
    differentCities,
  };
}

export type Schemas = ReturnType<typeof makeSchemas>;
export type CreateListingInput = z.output<Schemas['CreateListingInput']>;
export type CreateListingFormValues = z.input<Schemas['CreateListingInput']>;
export type UpdateMailInput = z.output<Schemas['UpdateMailInput']>;
export type UpdateTransferInput = z.output<Schemas['UpdateTransferInput']>;
export type FeedQuery = z.output<Schemas['FeedQuery']>;

export const IdParam = z.object({ id: z.string().uuid('Некорректный идентификатор') });

/** Пачка показов карточек в ленте; клиент шлёт не больше MAX_VIEWS_BATCH id за раз. */
export const MAX_VIEWS_BATCH = 50;
export const RecordViewsBody = z.object({
  ids: z.array(z.string().uuid('Некорректный идентификатор')).min(1).max(MAX_VIEWS_BATCH),
});

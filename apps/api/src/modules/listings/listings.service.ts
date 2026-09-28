import type { Prisma } from '@prisma/client';
import {
  MAX_ACTIVE_LISTINGS,
  normalizeCity,
  RecordViewsBody,
  type Schemas,
  type UserDto,
} from '@hyzmat/shared';
import type { Clock } from '../../lib/clock';
import { AppError, forbidden, notFound } from '../../lib/errors';
import type { RateLimiter } from '../../lib/rateLimiter';
import { parseOrThrow } from '../../lib/validate';
import {
  fromIsoDate,
  toIsoDate,
  toListingDto,
  toMyListingDto,
  type ListingWithAuthor,
} from './listings.mapper';
import type { ListingsRepo } from './listings.repo';

interface Deps {
  repo: ListingsRepo;
  schemas: Schemas;
  clock: Clock;
  createLimiter: RateLimiter;
  /** Уведомления подписчикам (есть, только если настроен бот). */
  notifier?: { listingCreated(row: ListingWithAuthor): Promise<unknown> };
}

export function createListingsService({ repo, schemas, clock, createLimiter, notifier }: Deps) {
  async function getOwned(id: string, user: UserDto) {
    const row = await repo.findById(id);
    if (!row) throw notFound();
    if (row.authorId.toString() !== user.id) throw forbidden();
    return row;
  }

  return {
    async feed(query: unknown, user: UserDto) {
      const q = parseOrThrow(schemas.FeedQuery, query);
      const page = await repo.feed(q, clock.today());
      return {
        items: page.items.map((r) => toListingDto(r, user.id)),
        nextCursor: page.nextCursor,
      };
    },

    async mine(user: UserDto) {
      const rows = await repo.findByAuthor(BigInt(user.id));
      const today = clock.today();
      return { items: rows.map((r) => toMyListingDto(r, user.id, today)) };
    },

    async getById(id: string, user: UserDto) {
      const row = await repo.findById(id);
      if (!row) throw notFound();
      return toMyListingDto(row, user.id, clock.today());
    },

    async create(body: unknown, user: UserDto) {
      const input = parseOrThrow(schemas.CreateListingInput, body);

      if (createLimiter.isLimited(user.id)) {
        throw new AppError(429, 'RATE_LIMITED', 'Слишком много новых заявок. Попробуйте через час');
      }
      if ((await repo.countByAuthor(BigInt(user.id))) >= MAX_ACTIVE_LISTINGS) {
        throw new AppError(
          409,
          'LISTING_LIMIT_REACHED',
          `Можно иметь не более ${MAX_ACTIVE_LISTINGS} заявок. Удалите ненужные`,
        );
      }

      const now = clock.now();
      const common = {
        authorId: BigInt(user.id),
        fromCity: input.fromCity,
        toCity: input.toCity,
        fromCityNorm: normalizeCity(input.fromCity),
        toCityNorm: normalizeCity(input.toCity),
        comment: input.comment ?? null,
        createdAt: now,
        updatedAt: now,
      };
      const row = await repo.create(
        input.type === 'MAIL'
          ? { ...common, type: 'MAIL', departureDate: fromIsoDate(input.departureDate) }
          : {
              ...common,
              type: 'TRANSFER',
              amount: input.amount,
              conditions: input.conditions ?? null,
            },
      );
      createLimiter.record(user.id);
      await notifier?.listingCreated(row);
      return toListingDto(row, user.id);
    },

    async update(id: string, body: unknown, user: UserDto) {
      const existing = await getOwned(id, user);

      if (body && typeof body === 'object' && 'type' in body && body.type !== existing.type) {
        throw new AppError(400, 'TYPE_IMMUTABLE', 'Тип заявки нельзя изменить');
      }

      let data: Prisma.ListingUncheckedUpdateInput;
      if (existing.type === 'MAIL') {
        const patch = parseOrThrow(schemas.UpdateMailInput, body);
        const merged = parseOrThrow(schemas.CreateListingInput, {
          type: 'MAIL',
          fromCity: existing.fromCity,
          toCity: existing.toCity,
          departureDate: toIsoDate(existing.departureDate!),
          comment: existing.comment ?? undefined,
          ...patch,
          ...(patch.comment === null ? { comment: undefined } : {}),
        });
        if (merged.type !== 'MAIL') throw new Error('unreachable');
        data = {
          fromCity: merged.fromCity,
          toCity: merged.toCity,
          departureDate: fromIsoDate(merged.departureDate),
          comment: merged.comment ?? null,
          // новая дата выезда — напомнить накануне и о ней
          ...(merged.departureDate !== toIsoDate(existing.departureDate!)
            ? { expiryNotifiedAt: null }
            : {}),
        };
      } else {
        const patch = parseOrThrow(schemas.UpdateTransferInput, body);
        const merged = parseOrThrow(schemas.CreateListingInput, {
          type: 'TRANSFER',
          fromCity: existing.fromCity,
          toCity: existing.toCity,
          amount: existing.amount!.toFixed(2),
          conditions: existing.conditions ?? undefined,
          comment: existing.comment ?? undefined,
          ...patch,
          ...(patch.conditions === null ? { conditions: undefined } : {}),
          ...(patch.comment === null ? { comment: undefined } : {}),
        });
        if (merged.type !== 'TRANSFER') throw new Error('unreachable');
        data = {
          fromCity: merged.fromCity,
          toCity: merged.toCity,
          amount: merged.amount,
          conditions: merged.conditions ?? null,
          comment: merged.comment ?? null,
        };
      }

      const row = await repo.update(id, {
        ...data,
        fromCityNorm: normalizeCity(String(data.fromCity)),
        toCityNorm: normalizeCity(String(data.toCity)),
        updatedAt: clock.now(),
      });
      return toMyListingDto(row, user.id, clock.today());
    },

    async remove(id: string, user: UserDto) {
      await getOwned(id, user);
      await repo.delete(id);
    },

    /** Показы в ленте: +1 каждой заявке из пачки, кроме заявок самого зрителя. */
    async recordViews(body: unknown, user: UserDto) {
      const { ids } = parseOrThrow(RecordViewsBody, body);
      await repo.recordViews([...new Set(ids)], BigInt(user.id));
    },
  };
}

export type ListingsService = ReturnType<typeof createListingsService>;

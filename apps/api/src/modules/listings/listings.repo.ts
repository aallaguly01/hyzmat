import type { Prisma, PrismaClient } from '@prisma/client';
import { normalizeCity, type FeedQuery } from '@hyzmat/shared';
import { decodeCursor, encodeCursor } from './cursor';
import { fromIsoDate, toIsoDate, type ListingWithAuthor } from './listings.mapper';

const withAuthor = { author: true } as const;

export function createListingsRepo(prisma: PrismaClient) {
  return {
    findById: (id: string) => prisma.listing.findUnique({ where: { id }, include: withAuthor }),

    countByAuthor: (authorId: bigint) => prisma.listing.count({ where: { authorId } }),

    findByAuthor: (authorId: bigint) =>
      prisma.listing.findMany({
        where: { authorId },
        include: withAuthor,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),

    create: (data: Prisma.ListingUncheckedCreateInput) =>
      prisma.listing.create({ data, include: withAuthor }),

    update: (id: string, data: Prisma.ListingUncheckedUpdateInput) =>
      prisma.listing.update({ where: { id }, data, include: withAuthor }),

    delete: (id: string) => prisma.listing.delete({ where: { id } }),

    async feed(q: FeedQuery, today: string) {
      const and: Prisma.ListingWhereInput[] = [{ type: q.type }];

      if (q.type === 'MAIL') and.push({ departureDate: { gte: fromIsoDate(today) } });

      if (q.city) {
        // % и _ — шаблоны LIKE; в названиях городов их нет, просто отбрасываем
        const needle = normalizeCity(q.city).replace(/[%_\\]/g, '');
        if (!needle) return { items: [] as ListingWithAuthor[], nextCursor: null };
        and.push({
          OR: [{ fromCityNorm: { contains: needle } }, { toCityNorm: { contains: needle } }],
        });
      }

      if (q.cursor) {
        const [dd, ca, id] = decodeCursor(q.cursor);
        const createdAt = new Date(ca);
        const afterCreated: Prisma.ListingWhereInput = {
          OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { gt: id } }],
        };
        if (q.type === 'MAIL' && dd) {
          const departureDate = fromIsoDate(dd);
          and.push({
            OR: [{ departureDate: { gt: departureDate } }, { departureDate, ...afterCreated }],
          });
        } else {
          and.push(afterCreated);
        }
      }

      const orderBy: Prisma.ListingOrderByWithRelationInput[] =
        q.type === 'MAIL'
          ? [{ departureDate: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'asc' }];

      const rows = await prisma.listing.findMany({
        where: { AND: and },
        include: withAuthor,
        orderBy,
        take: q.limit + 1,
      });

      const hasMore = rows.length > q.limit;
      const items = hasMore ? rows.slice(0, q.limit) : rows;
      const last = items.at(-1);
      const nextCursor =
        hasMore && last
          ? encodeCursor([
              last.departureDate ? toIsoDate(last.departureDate) : null,
              last.createdAt.toISOString(),
              last.id,
            ])
          : null;
      return { items, nextCursor };
    },
  };
}

export type ListingsRepo = ReturnType<typeof createListingsRepo>;

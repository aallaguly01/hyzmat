import type { ListingType, PrismaClient } from '@prisma/client';
import { normalizeCity } from '@hyzmat/shared';
import type { TgUser } from './initData';

export async function seedUser(db: PrismaClient, u: TgUser) {
  return db.user.upsert({
    where: { id: BigInt(u.id) },
    create: { id: BigInt(u.id), username: u.username ?? null, firstName: u.first_name },
    update: {},
  });
}

export async function seedListing(
  db: PrismaClient,
  author: TgUser,
  data: {
    type: ListingType;
    fromCity?: string;
    toCity?: string;
    departureDate?: string;
    amount?: string;
    createdAt?: Date;
  },
) {
  await seedUser(db, author);
  const fromCity = data.fromCity ?? 'Ашхабад';
  const toCity = data.toCity ?? 'Москва';
  return db.listing.create({
    data: {
      type: data.type,
      authorId: BigInt(author.id),
      fromCity,
      toCity,
      fromCityNorm: normalizeCity(fromCity),
      toCityNorm: normalizeCity(toCity),
      departureDate:
        data.type === 'MAIL' ? new Date(`${data.departureDate ?? '2026-10-10'}T00:00:00Z`) : null,
      amount: data.type === 'TRANSFER' ? (data.amount ?? '100') : null,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
    },
  });
}

import type { Listing, User } from '@prisma/client';
import { buildContactLink, isExpired, type ListingDto, type MyListingDto } from '@hyzmat/shared';

export type ListingWithAuthor = Listing & { author: User };

export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
export const fromIsoDate = (s: string) => new Date(`${s}T00:00:00Z`);

export function toListingDto(row: ListingWithAuthor, viewerId: string): ListingDto {
  const author = {
    id: row.author.id.toString(),
    username: row.author.username,
    firstName: row.author.firstName,
  };
  const base = {
    id: row.id,
    fromCity: row.fromCity,
    toCity: row.toCity,
    comment: row.comment,
    author,
    contact: buildContactLink(author),
    isOwn: author.id === viewerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.type === 'MAIL') {
    return { ...base, type: 'MAIL', departureDate: toIsoDate(row.departureDate!) };
  }
  return {
    ...base,
    type: 'TRANSFER',
    amount: row.amount!.toFixed(2),
    currency: 'USD',
    conditions: row.conditions,
  };
}

export function toMyListingDto(
  row: ListingWithAuthor,
  viewerId: string,
  today: string,
): MyListingDto {
  const dto = toListingDto(row, viewerId);
  return {
    ...dto,
    isExpired: isExpired(
      { type: dto.type, departureDate: dto.type === 'MAIL' ? dto.departureDate : null },
      today,
    ),
  };
}

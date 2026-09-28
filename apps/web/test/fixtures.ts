import type { MailListingDto, MyListingDto, TransferListingDto } from '@hyzmat/shared';

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

const bob = { id: '1002', username: 'bob', firstName: 'Боб' };

export function mailListing(over: Partial<MailListingDto> = {}): MailListingDto {
  const author = over.author ?? bob;
  return {
    id: uuid(),
    type: 'MAIL',
    fromCity: 'Ашхабад',
    toCity: 'Москва',
    comment: null,
    departureDate: '2026-10-15',
    author,
    contact: author.username
      ? { url: `https://t.me/${author.username}`, label: `@${author.username}`, kind: 'username' }
      : { url: `tg://user?id=${author.id}`, label: author.firstName, kind: 'id' },
    isOwn: false,
    viewCount: 0,
    createdAt: '2026-09-27T10:00:00.000Z',
    updatedAt: '2026-09-27T10:00:00.000Z',
    ...over,
  };
}

export function transferListing(over: Partial<TransferListingDto> = {}): TransferListingDto {
  const author = over.author ?? bob;
  return {
    id: uuid(),
    type: 'TRANSFER',
    fromCity: 'Ашхабад',
    toCity: 'Стамбул',
    comment: null,
    amount: '1500.00',
    currency: 'USD',
    conditions: 'Комиссия 2%',
    author,
    contact: author.username
      ? { url: `https://t.me/${author.username}`, label: `@${author.username}`, kind: 'username' }
      : { url: `tg://user?id=${author.id}`, label: author.firstName, kind: 'id' },
    isOwn: false,
    viewCount: 0,
    createdAt: '2026-09-27T10:00:00.000Z',
    updatedAt: '2026-09-27T10:00:00.000Z',
    ...over,
  };
}

const alice = { id: '1001', username: 'alice', firstName: 'Алиса' };

export function myMail(over: Partial<MailListingDto> & { isExpired?: boolean } = {}): MyListingDto {
  const { isExpired = false, ...rest } = over;
  return { ...mailListing({ author: alice, isOwn: true, ...rest }), isExpired };
}

export function myTransfer(
  over: Partial<TransferListingDto> & { isExpired?: boolean } = {},
): MyListingDto {
  const { isExpired = false, ...rest } = over;
  return { ...transferListing({ author: alice, isOwn: true, ...rest }), isExpired };
}

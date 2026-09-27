import type { Contact } from './contact';
import type { ErrorCode } from './constants';

export interface UserDto {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
}

export interface AuthorDto {
  id: string;
  username: string | null;
  firstName: string;
}

interface ListingBase {
  id: string;
  fromCity: string;
  toCity: string;
  author: AuthorDto;
  contact: Contact;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MailListingDto extends ListingBase {
  type: 'MAIL';
  departureDate: string;
}

export interface TransferListingDto extends ListingBase {
  type: 'TRANSFER';
  amount: string;
  currency: 'USD';
  conditions: string | null;
}

export type ListingDto = MailListingDto | TransferListingDto;
export type MyListingDto = ListingDto & { isExpired: boolean };

export interface ListingPageDto {
  items: ListingDto[];
  nextCursor: string | null;
}

export interface MyListingsDto {
  items: MyListingDto[];
}

export interface ApiErrorIssue {
  path: (string | number)[];
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorIssue[];
  };
}

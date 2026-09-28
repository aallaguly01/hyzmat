import { formatAmount, formatDate, type ListingDto, type MyListingDto } from '@hyzmat/shared';
import type { ReactNode } from 'react';
import s from './ListingCard.module.css';

const TYPE_LABEL = { MAIL: 'Почта', TRANSFER: 'Перевод' } as const;

interface Props {
  listing: ListingDto | MyListingDto;
  /** Бейдж типа — в «Моих заявках», где типы перемешаны. */
  showType?: boolean;
  footer: ReactNode;
}

export function ListingCard({ listing, showType, footer }: Props) {
  const expired = 'isExpired' in listing && listing.isExpired;
  return (
    <article className={s.card} data-expired={expired ? 'true' : undefined}>
      {(showType || expired) && (
        <div className={s.badges}>
          {showType && <span className={s.badge}>{TYPE_LABEL[listing.type]}</span>}
          {expired && <span className={`${s.badge} ${s.expired}`}>Истекла</span>}
        </div>
      )}

      <div className={s.route}>
        <span>{listing.fromCity}</span>
        <span className={s.arrow} aria-label="→">
          ➔
        </span>
        <span>{listing.toCity}</span>
      </div>

      {listing.type === 'MAIL' ? (
        <div className={s.meta}>
          <span aria-hidden>✈</span> <span>{formatDate(listing.departureDate)}</span>
        </div>
      ) : (
        <div className={s.meta}>
          <span className={s.amount}>{formatAmount(listing.amount)}</span>
          {listing.conditions && (
            <>
              <span aria-hidden> · </span>
              <span data-testid="listing-conditions">{listing.conditions}</span>
            </>
          )}
        </div>
      )}

      {listing.comment && (
        <p className={s.comment} data-testid="listing-comment">
          {listing.comment}
        </p>
      )}

      {expired && <p className={s.hint}>Не показывается в ленте. Измените дату, чтобы продлить</p>}

      <div className={s.footer}>{footer}</div>
    </article>
  );
}

import {
  formatAmount,
  formatDate,
  formatViews,
  type ListingDto,
  type MyListingDto,
} from '@hyzmat/shared';
import type { ReactNode, Ref } from 'react';
import { EyeIcon } from './EyeIcon';
import s from './ListingCard.module.css';

const TYPE_LABEL = { MAIL: 'Почта', TRANSFER: 'Перевод' } as const;

interface Props {
  listing: ListingDto | MyListingDto;
  /** Бейдж типа — в «Моих заявках», где типы перемешаны. */
  showType?: boolean;
  footer: ReactNode;
  cardRef?: Ref<HTMLElement>;
  /** Подсветка карточки, открытой по ссылке. */
  highlighted?: boolean;
}

export function ListingCard({ listing, showType, footer, cardRef, highlighted }: Props) {
  const expired = 'isExpired' in listing && listing.isExpired;
  return (
    <article
      ref={cardRef}
      className={s.card}
      data-listing-id={listing.id}
      data-expired={expired ? 'true' : undefined}
      data-highlighted={highlighted ? 'true' : undefined}
    >
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

      <div className={s.metaRow}>
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
        <span className={s.views} aria-label={`Просмотры: ${listing.viewCount}`}>
          <EyeIcon />
          {formatViews(listing.viewCount)}
        </span>
      </div>

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

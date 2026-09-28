import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../shared/api/client';
import { useListing } from '../../shared/api/queries';
import { useBackButton } from '../../shared/telegram/hooks';
import { openContact } from '../../shared/telegram/webapp';
import card from '../../shared/ui/ListingCard.module.css';
import { ListingCard } from '../../shared/ui/ListingCard';
import { ShareButton } from '../../shared/ui/ShareButton';
import { EmptyState, ErrorState, SkeletonList } from '../../shared/ui/States';
import ui from '../../shared/ui/ui.module.css';

/** Одна заявка — сюда ведут ссылки t.me/<бот>?startapp=l-<id> из бота и «Поделиться». */
export function ListingViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const listing = useListing(id);

  // открыли по ссылке — истории внутри приложения нет, «назад» ведёт в ленту
  const back = () => (location.key === 'default' ? navigate('/feed') : navigate(-1));
  useBackButton(back);

  const toFeed = (
    <button type="button" className={ui.button} onClick={() => navigate('/feed')}>
      В ленту
    </button>
  );

  let content;
  if (listing.isPending) {
    content = <SkeletonList count={1} />;
  } else if (listing.isError) {
    content =
      listing.error instanceof ApiError && listing.error.status === 404 ? (
        <EmptyState text="Заявка удалена или не найдена" action={toFeed} />
      ) : (
        <ErrorState message={listing.error.message} onRetry={() => void listing.refetch()} />
      );
  } else if (listing.data.isExpired && !listing.data.isOwn) {
    content = <EmptyState text="Эта заявка уже неактуальна" action={toFeed} />;
  } else {
    const l = listing.data;
    content = (
      <ListingCard
        listing={l}
        showType
        footer={
          <>
            <span className={card.author}>{l.contact.label}</span>
            <div className={card.actions}>
              <ShareButton listing={l} />
              {l.isOwn ? (
                <button
                  type="button"
                  className={`${ui.button} ${ui.secondary}`}
                  onClick={() => navigate(`/listings/${l.id}/edit`)}
                >
                  Редактировать
                </button>
              ) : (
                <button type="button" className={ui.button} onClick={() => openContact(l.contact)}>
                  Написать
                </button>
              )}
            </div>
          </>
        }
      />
    );
  }

  return <main className={ui.page}>{content}</main>;
}

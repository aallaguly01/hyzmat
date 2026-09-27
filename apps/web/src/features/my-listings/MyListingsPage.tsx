import { MAX_ACTIVE_LISTINGS, type MyListingDto } from '@hyzmat/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteListing, useMyListings } from '../../shared/api/queries';
import { haptic, showAlert, showConfirm } from '../../shared/telegram/webapp';
import card from '../../shared/ui/ListingCard.module.css';
import { ListingCard } from '../../shared/ui/ListingCard';
import { EmptyState, ErrorState, SkeletonList } from '../../shared/ui/States';
import ui from '../../shared/ui/ui.module.css';
import s from './MyListingsPage.module.css';

function MyCard({ listing, onDelete }: { listing: MyListingDto; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await showConfirm('Удалить заявку?');
    if (ok) onDelete(listing.id);
    else setBusy(false);
  };

  return (
    <ListingCard
      listing={listing}
      showType
      footer={
        <div className={card.actions}>
          <button
            type="button"
            className={`${ui.button} ${ui.secondary}`}
            disabled={busy}
            onClick={() => navigate(`/listings/${listing.id}/edit`)}
          >
            Редактировать
          </button>
          <button
            type="button"
            className={`${ui.button} ${ui.danger}`}
            disabled={busy}
            onClick={() => void remove()}
          >
            Удалить
          </button>
        </div>
      }
    />
  );
}

export function MyListingsPage() {
  const navigate = useNavigate();
  const mine = useMyListings();
  const del = useDeleteListing({
    onSuccess: haptic.success,
    onError: (e) => {
      haptic.error();
      void showAlert(e.message);
    },
  });

  const items = mine.data?.items ?? [];
  const limitReached = items.length >= MAX_ACTIVE_LISTINGS;

  const create = () => {
    if (limitReached) {
      void showAlert(`Можно иметь не более ${MAX_ACTIVE_LISTINGS} заявок. Удалите ненужные.`);
      return;
    }
    navigate('/listings/new');
  };

  let content;
  if (mine.isPending) {
    content = <SkeletonList />;
  } else if (mine.isError) {
    content = <ErrorState message={mine.error.message} onRetry={() => void mine.refetch()} />;
  } else if (items.length === 0) {
    content = (
      <EmptyState
        text="У вас пока нет заявок"
        action={
          <button type="button" className={ui.button} onClick={create}>
            Создать заявку
          </button>
        }
      />
    );
  } else {
    content = (
      <div className={ui.list}>
        {items.map((l) => (
          <MyCard key={l.id} listing={l} onDelete={(id) => del.mutate(id)} />
        ))}
      </div>
    );
  }

  return (
    <main className={ui.page}>
      <h1 className={ui.title}>Мои заявки</h1>
      {content}
      {items.length > 0 && (
        <button
          type="button"
          className={`${ui.button} ${s.fab}`}
          aria-disabled={limitReached || undefined}
          onClick={create}
        >
          + Создать заявку
        </button>
      )}
    </main>
  );
}

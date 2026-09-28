import type { ListingDto, ListingType } from '@hyzmat/shared';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedFilter } from '../../app/FeedFilter';
import { useFeed } from '../../shared/api/queries';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import { openContact } from '../../shared/telegram/webapp';
import card from '../../shared/ui/ListingCard.module.css';
import { ListingCard } from '../../shared/ui/ListingCard';
import { SearchInput } from '../../shared/ui/SearchInput';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { ShareButton } from '../../shared/ui/ShareButton';
import { EmptyState, ErrorState, SkeletonList } from '../../shared/ui/States';
import ui from '../../shared/ui/ui.module.css';
import s from './FeedPage.module.css';
import { useViewTracking } from './viewTracker';

const TYPE_OPTIONS: { value: ListingType; label: string }[] = [
  { value: 'MAIL', label: 'Почта' },
  { value: 'TRANSFER', label: 'Перевод' },
];

function FeedCard({ listing }: { listing: ListingDto }) {
  const ref = useViewTracking<HTMLElement>(listing.id, !listing.isOwn);
  return (
    <ListingCard
      cardRef={ref}
      listing={listing}
      footer={
        <>
          <span className={card.author}>{listing.contact.label}</span>
          <div className={card.actions}>
            <ShareButton listing={listing} />
            {listing.isOwn ? (
              <span className={card.own}>Ваша заявка</span>
            ) : (
              <button
                type="button"
                className={ui.button}
                onClick={() => openContact(listing.contact)}
              >
                Написать
              </button>
            )}
          </div>
        </>
      }
    />
  );
}

function LoadMore({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) cb.current();
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} data-testid="feed-sentinel" className={s.sentinel} />;
}

export function FeedPage() {
  const navigate = useNavigate();
  const { type, setType, city, setCity } = useFeedFilter();
  const trimmed = city.trim();
  const debounced = useDebouncedValue(trimmed, 300);
  // очистка поиска применяется сразу, ввод — с задержкой
  const debouncedCity = trimmed ? debounced : '';
  const feed = useFeed(type, debouncedCity);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  let content;
  if (feed.isPending) {
    content = <SkeletonList />;
  } else if (feed.isError) {
    content = <ErrorState message={feed.error.message} onRetry={() => void feed.refetch()} />;
  } else if (items.length === 0) {
    content = debouncedCity ? (
      <EmptyState text={`По запросу «${debouncedCity}» ничего не найдено`} />
    ) : (
      <EmptyState
        text="Пока нет заявок. Создайте первую!"
        action={
          <button type="button" className={ui.button} onClick={() => navigate('/listings/new')}>
            Создать заявку
          </button>
        }
      />
    );
  } else {
    content = (
      <div className={ui.list}>
        {items.map((l) => (
          <FeedCard key={l.id} listing={l} />
        ))}
        {feed.hasNextPage && (
          <LoadMore
            onVisible={() => {
              if (!feed.isFetchingNextPage) void feed.fetchNextPage();
            }}
          />
        )}
        {feed.isFetchingNextPage && <div className={ui.spinner}>Загрузка…</div>}
      </div>
    );
  }

  return (
    <main className={ui.page}>
      <div className={s.filters}>
        <SegmentedControl
          label="Тип заявки"
          value={type}
          options={TYPE_OPTIONS}
          onChange={setType}
        />
        <SearchInput value={city} onChange={setCity} placeholder="Поиск по городу" />
      </div>
      {content}
    </main>
  );
}

import { CITY_MIN, normalizeCity, type ListingType } from '@hyzmat/shared';
import { useSubscribe, useSubscriptions, useUnsubscribe } from '../../shared/api/queries';
import { haptic, requestWriteAccess, showAlert } from '../../shared/telegram/webapp';
import ui from '../../shared/ui/ui.module.css';
import s from './FeedPage.module.css';

const onError = (e: Error) => {
  haptic.error();
  void showAlert(e.message);
};

/** «🔔 Следить за „Балкан“»: бот напишет о новых заявках этого типа по этому городу. */
export function FollowButton({ type, city }: { type: ListingType; city: string }) {
  const subs = useSubscriptions();
  const subscribe = useSubscribe();
  const unsubscribe = useUnsubscribe({ onError });

  if (city.length < CITY_MIN || !subs.data) return null;
  const norm = normalizeCity(city);
  const current = subs.data.items.find((x) => x.type === type && normalizeCity(x.city) === norm);
  const busy = subscribe.isPending || unsubscribe.isPending;

  const toggle = async () => {
    if (busy) return;
    if (current) {
      haptic.selection();
      unsubscribe.mutate(current.id);
      return;
    }
    // без разрешения бот не сможет написать тому, кто его ни разу не запускал
    if (!(await requestWriteAccess())) {
      void showAlert('Разрешите боту писать вам — иначе уведомления не придут');
      return;
    }
    subscribe.mutate({ type, city }, { onSuccess: () => haptic.success(), onError });
  };

  return (
    <button
      type="button"
      className={`${ui.button} ${ui.secondary} ${s.follow}`}
      aria-pressed={!!current}
      disabled={busy}
      onClick={() => void toggle()}
    >
      {current ? `🔕 Не следить за «${city}»` : `🔔 Следить за «${city}»`}
    </button>
  );
}

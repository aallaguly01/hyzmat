import { useSubscriptions, useUnsubscribe } from '../../shared/api/queries';
import { haptic, showAlert } from '../../shared/telegram/webapp';
import s from './MyListingsPage.module.css';

const TYPE_ICON = { MAIL: '📦', TRANSFER: '💸' } as const;
const TYPE_LABEL = { MAIL: 'Почта', TRANSFER: 'Перевод' } as const;

/** Подписки на новые заявки; добавляются кнопкой «Следить» в ленте. */
export function Subscriptions() {
  const subs = useSubscriptions();
  const unsubscribe = useUnsubscribe({
    onError: (e) => {
      haptic.error();
      void showAlert(e.message);
    },
  });

  const items = subs.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className={s.subs} aria-labelledby="subs-title">
      <h2 id="subs-title" className={s.subsTitle}>
        🔔 Уведомления о новых заявках
      </h2>
      <ul className={s.subsList}>
        {items.map((sub) => (
          <li key={sub.id} className={s.sub}>
            <span>
              {TYPE_ICON[sub.type]} {TYPE_LABEL[sub.type]} · {sub.city}
            </span>
            <button
              type="button"
              className={s.subRemove}
              aria-label={`Не следить: ${TYPE_LABEL[sub.type]}, ${sub.city}`}
              onClick={() => {
                haptic.selection();
                unsubscribe.mutate(sub.id);
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

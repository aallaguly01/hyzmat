import type { ListingDto } from '@hyzmat/shared';
import { botUsername, shareListing } from '../telegram/webapp';
import ui from './ui.module.css';

/** Стрелка «поделиться» в стиле iOS: квадрат со стрелкой вверх. */
function ShareIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Без VITE_BOT_USERNAME кнопка не показывается: ссылку на заявку не построить. */
export function ShareButton({ listing }: { listing: ListingDto }) {
  if (!botUsername()) return null;
  return (
    <button
      type="button"
      className={`${ui.button} ${ui.secondary} ${ui.icon}`}
      aria-label="Поделиться"
      onClick={() => shareListing(listing)}
    >
      <ShareIcon />
    </button>
  );
}

import { NavLink } from 'react-router-dom';
import { haptic } from '../telegram/webapp';
import s from './BottomTabs.module.css';

const FeedIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="4" y="4" width="16" height="6" rx="2" />
    <rect x="4" y="14" width="16" height="6" rx="2" />
  </svg>
);

const MyIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9 5h10M9 12h10M9 19h10" />
    <circle cx="4.5" cy="5" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="19" r="1" />
  </svg>
);

export function BottomTabs() {
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? `${s.tab} ${s.active}` : s.tab);
  return (
    <nav className={s.tabs} aria-label="Разделы">
      <NavLink to="/feed" className={cls} onClick={haptic.selection}>
        <FeedIcon />
        <span>Лента</span>
      </NavLink>
      <NavLink to="/my" className={cls} onClick={haptic.selection}>
        <MyIcon />
        <span>Мои заявки</span>
      </NavLink>
    </nav>
  );
}

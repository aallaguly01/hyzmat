import type { ReactNode } from 'react';
import s from './ui.module.css';

export function CardSkeleton() {
  return <div className={s.skeleton} data-testid="card-skeleton" aria-hidden />;
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className={s.list} aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className={s.center}>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={s.center} role="alert">
      <p>{message}</p>
      <button type="button" className={s.button} onClick={onRetry}>
        Повторить
      </button>
    </div>
  );
}

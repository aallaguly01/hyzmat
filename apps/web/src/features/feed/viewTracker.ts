import { MAX_VIEWS_BATCH } from '@hyzmat/shared';
import { useEffect, useRef } from 'react';
import { api } from '../../shared/api/client';

/** Сколько карточка должна провисеть на экране, чтобы засчитать показ. */
export const VIEW_DWELL_MS = 1_000;
/** Как часто отправлять накопленные показы. */
export const VIEW_FLUSH_MS = 2_000;

// За одно открытие приложения каждая заявка засчитывается один раз,
// иначе скролл туда-обратно накручивал бы счётчик
const seen = new Set<string>();
let queue: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

export function flushViews() {
  clearTimeout(flushTimer);
  flushTimer = undefined;
  const ids = queue;
  queue = [];
  for (let i = 0; i < ids.length; i += MAX_VIEWS_BATCH) {
    // Потерянный показ не стоит ошибки в интерфейсе
    api('/listings/views', {
      method: 'POST',
      body: { ids: ids.slice(i, i + MAX_VIEWS_BATCH) },
    }).catch(() => {});
  }
}

function trackView(id: string) {
  if (seen.has(id)) return;
  seen.add(id);
  queue.push(id);
  flushTimer ??= setTimeout(flushViews, VIEW_FLUSH_MS);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushViews();
  });
}

/** Для тестов: забыть учтённые показы. */
export function resetViewTracker() {
  seen.clear();
  queue = [];
  clearTimeout(flushTimer);
  flushTimer = undefined;
}

/** Ref для карточки: засчитывает показ, когда она ≥50% видна дольше VIEW_DWELL_MS. */
export function useViewTracking<T extends Element>(id: string, enabled: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let dwell: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          dwell ??= setTimeout(() => trackView(id), VIEW_DWELL_MS);
        } else {
          clearTimeout(dwell);
          dwell = undefined;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      clearTimeout(dwell);
      io.disconnect();
    };
  }, [id, enabled]);
  return ref;
}

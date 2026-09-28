import { normalizeCity, POPULAR_CITIES } from '@hyzmat/shared';
import { haptic } from '../telegram/webapp';
import s from './Controls.module.css';

interface Props {
  /** Подпись поля — из неё строится aria-label группы. */
  label: string;
  value: string;
  /** Город соседнего поля: его чипс неактивен, города должны различаться. */
  disabledValue?: string;
  onPick: (city: string) => void;
}

/** Быстрый выбор популярного города под полем ввода. */
export function CityChips({ label, value, disabledValue, onPick }: Props) {
  const current = normalizeCity(value);
  const other = disabledValue ? normalizeCity(disabledValue) : '';
  return (
    <div className={s.chips} role="group" aria-label={`Быстрый выбор: ${label}`}>
      {POPULAR_CITIES.map((city) => {
        const norm = normalizeCity(city);
        const selected = norm === current;
        return (
          <button
            key={city}
            type="button"
            aria-pressed={selected}
            disabled={norm === other}
            className={selected ? `${s.chip} ${s.chipSelected}` : s.chip}
            onClick={() => {
              if (selected) return;
              haptic.selection();
              onPick(city);
            }}
          >
            {city}
          </button>
        );
      })}
    </div>
  );
}

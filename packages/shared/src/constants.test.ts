import { describe, expect, it } from 'vitest';
import { normalizeCity } from './city';
import { POPULAR_CITIES } from './constants';
import { makeSchemas } from './schemas';

const s = makeSchemas({ today: () => '2026-09-27' });

describe('POPULAR_CITIES', () => {
  it('7 городов в заданном порядке', () => {
    expect(POPULAR_CITIES).toEqual([
      'Балкан',
      'Ашхабад',
      'Мары',
      'Лебап',
      'Дашогуз',
      'Казань',
      'Москва',
    ]);
  });

  it('каждый город проходит схему города', () => {
    for (const city of POPULAR_CITIES) {
      const r = s.MailFields.pick({ fromCity: true }).safeParse({ fromCity: city });
      expect(r.success, city).toBe(true);
    }
  });

  it('нормализованные значения уникальны', () => {
    const norm = POPULAR_CITIES.map(normalizeCity);
    expect(new Set(norm).size).toBe(norm.length);
  });
});

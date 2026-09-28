import { describe, expect, it } from 'vitest';
import { CITY_ALIASES, normalizeCity, resolveCityAlias } from './city';
import { POPULAR_CITIES } from './constants';

describe('normalizeCity', () => {
  it('обрезает пробелы и приводит к нижнему регистру', () => {
    expect(normalizeCity('  Ашхабад ')).toBe('ашхабад');
  });
  it('схлопывает внутренние пробелы', () => {
    expect(normalizeCity('Нью   Йорк')).toBe('нью йорк');
  });
  it('заменяет ё на е', () => {
    expect(normalizeCity('Орёл')).toBe('орел');
  });
});

describe('resolveCityAlias', () => {
  it.each([
    ['balkan', 'Балкан'],
    ['  Balkan ', 'Балкан'],
    ['ASHGABAT', 'Ашхабад'],
    ['Aşgabat', 'Ашхабад'],
    ['moscow', 'Москва'],
  ])('%s → %s', (input, expected) => {
    expect(resolveCityAlias(input)).toBe(expected);
  });

  it('незнакомый город возвращается как есть', () => {
    expect(resolveCityAlias('  Туркменбаши ')).toBe('Туркменбаши');
  });

  it('каждый алиас ведёт на популярный город', () => {
    for (const city of Object.values(CITY_ALIASES)) {
      expect(POPULAR_CITIES).toContain(city);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeCity } from './city';

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

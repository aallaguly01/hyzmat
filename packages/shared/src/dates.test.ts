import { describe, expect, it } from 'vitest';
import { addDays, formatDate, isExpired, isValidIsoDate, todayUtc } from './dates';

describe('todayUtc', () => {
  it('возвращает UTC-дату в формате YYYY-MM-DD', () => {
    expect(todayUtc(new Date('2026-09-27T23:30:00-05:00'))).toBe('2026-09-28');
  });
});

describe('addDays', () => {
  it('прибавляет дни с переходом месяца и года', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('isValidIsoDate', () => {
  it('принимает существующую дату', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
  });
  it('отклоняет несуществующую дату и неверный формат', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('27.09.2026')).toBe(false);
  });
});

describe('isExpired', () => {
  const today = '2026-09-27';
  it('MAIL с датой в прошлом — истекла', () => {
    expect(isExpired({ type: 'MAIL', departureDate: '2026-09-26' }, today)).toBe(true);
  });
  it('MAIL с сегодняшней датой — не истекла', () => {
    expect(isExpired({ type: 'MAIL', departureDate: today }, today)).toBe(false);
  });
  it('TRANSFER никогда не истекает', () => {
    expect(isExpired({ type: 'TRANSFER' }, today)).toBe(false);
  });
});

describe('formatDate', () => {
  it('форматирует как «15 окт 2026»', () => {
    expect(formatDate('2026-10-15')).toBe('15 окт 2026');
    expect(formatDate('2027-01-02')).toBe('2 янв 2027');
  });
});

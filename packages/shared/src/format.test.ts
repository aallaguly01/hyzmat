import { describe, expect, it } from 'vitest';
import { formatAmount } from './format';

const NBSP = ' ';

describe('formatAmount', () => {
  it('без копеек, если они нулевые', () => {
    expect(formatAmount('1500.00')).toBe(`$1${NBSP}500`);
  });
  it('с копейками, если они есть', () => {
    expect(formatAmount('99.50')).toBe('$99.50');
  });
  it('разбивает крупные суммы на разряды', () => {
    expect(formatAmount('1000000.00')).toBe(`$1${NBSP}000${NBSP}000`);
  });
});

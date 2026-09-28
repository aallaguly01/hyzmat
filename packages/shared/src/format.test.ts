import { describe, expect, it } from 'vitest';
import { formatAmount, formatViews } from './format';

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

describe('formatViews', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1K'],
    [1049, '1K'],
    [1250, '1.2K'],
    [12_345, '12.3K'],
    [99_999, '99.9K'],
    [150_700, '150K'],
    [999_999, '999K'],
    [1_000_000, '1M'],
    [1_560_000, '1.5M'],
  ])('%i → %s', (n, expected) => {
    expect(formatViews(n)).toBe(expected);
  });
});

import { describe, expect, it } from 'vitest';
import { POPULAR_CITIES } from './constants';
import { feedStartParam, listingStartParam, parseStartParam } from './deeplink';

const ID = '3f1c2a9e-8b7d-4c6e-9a5b-1d2e3f4a5b6c';
const SAFE = /^[A-Za-z0-9_-]{1,64}$/;

describe('deeplink', () => {
  it('заявка: туда и обратно', () => {
    const p = listingStartParam(ID);
    expect(p).toMatch(SAFE);
    expect(parseStartParam(p)).toEqual({ kind: 'listing', id: ID });
  });

  it('лента без города', () => {
    expect(feedStartParam('MAIL')).toBe('f-MAIL');
    expect(parseStartParam('f-TRANSFER')).toEqual({ kind: 'feed', type: 'TRANSFER' });
  });

  it.each([...POPULAR_CITIES, 'Нью Йорк', 'Orël', 'a', 'ab', 'abc', 'Türkmenbaşy'])(
    'город «%s»: туда и обратно, только разрешённые символы',
    (city) => {
      const p = feedStartParam('MAIL', city);
      expect(p).toMatch(SAFE);
      expect(parseStartParam(p)).toEqual({ kind: 'feed', type: 'MAIL', city });
    },
  );

  it('слишком длинный город → лента без фильтра', () => {
    expect(feedStartParam('MAIL', 'Я'.repeat(40))).toBe('f-MAIL');
  });

  it('пробельный город игнорируется', () => {
    expect(feedStartParam('MAIL', '   ')).toBe('f-MAIL');
  });

  it.each([
    [undefined],
    [''],
    ['l-not-a-uuid'],
    ['f-OTHER'],
    ['f-mail'],
    ['x-' + ID],
    ['f-MAIL-' + 'A'.repeat(80)],
  ])('мусор %s → null', (p) => {
    expect(parseStartParam(p)).toBeNull();
  });

  it('битый base64 города → лента без города', () => {
    expect(parseStartParam('f-MAIL-A')).toEqual({ kind: 'feed', type: 'MAIL' });
    expect(parseStartParam('f-MAIL-_w')).toEqual({ kind: 'feed', type: 'MAIL' });
  });
});

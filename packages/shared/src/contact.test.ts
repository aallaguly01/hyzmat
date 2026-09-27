import { describe, expect, it } from 'vitest';
import { buildContactLink } from './contact';

describe('buildContactLink', () => {
  it('Есть username', () => {
    expect(buildContactLink({ id: '42', username: 'ivan', firstName: 'Иван' })).toEqual({
      url: 'https://t.me/ivan',
      label: '@ivan',
      kind: 'username',
    });
  });
  it('Нет username', () => {
    expect(buildContactLink({ id: '42', username: null, firstName: 'Иван' })).toEqual({
      url: 'tg://user?id=42',
      label: 'Иван',
      kind: 'id',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { signInitData } from '../../../test/helpers/initData';
import { validateInitData } from './validateInitData';

const BOT_TOKEN = '123456:TEST-TOKEN';
const NOW = 1_790_000_000;
const TTL = 86_400;
const user = { id: 42, first_name: 'Иван', last_name: 'Петров', username: 'ivan' };

const validate = (raw: string, now = NOW) =>
  validateInitData(raw, { botToken: BOT_TOKEN, ttlSeconds: TTL, nowSeconds: now });

describe('validateInitData', () => {
  it('Валидная подпись', () => {
    const raw = signInitData({ botToken: BOT_TOKEN, user, authDate: NOW - 60 });
    expect(validate(raw)).toEqual({
      id: '42',
      username: 'ivan',
      firstName: 'Иван',
      lastName: 'Петров',
    });
  });

  it('пользователь без username и фамилии', () => {
    const raw = signInitData({
      botToken: BOT_TOKEN,
      user: { id: 7, first_name: 'Аня' },
      authDate: NOW,
    });
    expect(validate(raw)).toEqual({ id: '7', username: null, firstName: 'Аня', lastName: null });
  });

  it('учитывает дополнительные поля (например, signature) в строке проверки', () => {
    const raw = signInitData({
      botToken: BOT_TOKEN,
      user,
      authDate: NOW,
      extra: { signature: 'abc', chat_type: 'private' },
    });
    expect(validate(raw).id).toBe('42');
  });

  it('Неверная подпись: изменено поле', () => {
    const raw = signInitData({ botToken: BOT_TOKEN, user, authDate: NOW });
    const tampered = raw.replace('ivan', 'hacker');
    expect(() => validate(tampered)).toThrowError(
      expect.objectContaining({ code: 'INVALID_INIT_DATA' }),
    );
  });

  it('Неверная подпись: другой токен бота', () => {
    const raw = signInitData({ botToken: 'other:token', user, authDate: NOW });
    expect(() => validate(raw)).toThrowError(
      expect.objectContaining({ code: 'INVALID_INIT_DATA' }),
    );
  });

  it('Неверная подпись: нет hash', () => {
    expect(() => validate('auth_date=1&user=%7B%7D')).toThrowError(
      expect.objectContaining({ code: 'INVALID_INIT_DATA' }),
    );
  });

  it('Просроченная initData', () => {
    const raw = signInitData({ botToken: BOT_TOKEN, user, authDate: NOW - TTL - 1 });
    expect(() => validate(raw)).toThrowError(
      expect.objectContaining({ code: 'INIT_DATA_EXPIRED' }),
    );
  });

  it('В initData нет пользователя', () => {
    const raw = signInitData({ botToken: BOT_TOKEN, authDate: NOW });
    expect(() => validate(raw)).toThrowError(
      expect.objectContaining({ code: 'INVALID_INIT_DATA' }),
    );
  });

  it('user не парсится как JSON', () => {
    const raw = signInitData({ botToken: BOT_TOKEN, user: '{broken', authDate: NOW });
    expect(() => validate(raw)).toThrowError(
      expect.objectContaining({ code: 'INVALID_INIT_DATA' }),
    );
  });
});

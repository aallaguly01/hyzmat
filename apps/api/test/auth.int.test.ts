import { beforeEach, describe, expect, it } from 'vitest';
import { BOT_TOKEN, createTestContext, USERS, type TestContext } from './helpers/context';
import { signInitData } from './helpers/initData';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});

describe('telegram-auth: Серверная валидация initData', () => {
  it('Валидная подпись', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: ctx.auth(USERS.alice),
    });
    expect(res.statusCode).toBe(200);
  });

  it('Отсутствует заголовок', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('Заголовок без префикса tma', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer abc' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('Неверная подпись', async () => {
    const raw = signInitData({
      botToken: 'wrong:token',
      user: USERS.alice,
      authDate: Math.floor(ctx.clock.now().getTime() / 1000),
    });
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `tma ${raw}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_INIT_DATA');
  });

  it('Просроченная initData', async () => {
    const raw = signInitData({
      botToken: BOT_TOKEN,
      user: USERS.alice,
      authDate: Math.floor(ctx.clock.now().getTime() / 1000) - 86_401,
    });
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `tma ${raw}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INIT_DATA_EXPIRED');
  });

  it('В initData нет пользователя', async () => {
    const raw = signInitData({
      botToken: BOT_TOKEN,
      authDate: Math.floor(ctx.clock.now().getTime() / 1000),
    });
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `tma ${raw}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_INIT_DATA');
  });

  it('health-check доступен без авторизации', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('telegram-auth: Синхронизация пользователя', () => {
  it('Первый вход', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: ctx.auth({ id: 42, first_name: 'Иван', last_name: 'Петров', username: 'ivan' }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: '42',
      username: 'ivan',
      firstName: 'Иван',
      lastName: 'Петров',
    });
    const row = await ctx.db.user.findUnique({ where: { id: 42n } });
    expect(row).toMatchObject({ username: 'ivan', firstName: 'Иван', lastName: 'Петров' });
  });

  it('Пользователь сменил username', async () => {
    const create = await ctx.app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: ctx.auth({ id: 50, first_name: 'Олег', username: 'old' }),
      payload: { type: 'TRANSFER', fromCity: 'Ашхабад', toCity: 'Стамбул', amount: '100' },
    });
    expect(create.statusCode).toBe(201);

    await ctx.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: ctx.auth({ id: 50, first_name: 'Олег', username: 'new' }),
    });
    const row = await ctx.db.user.findUnique({ where: { id: 50n } });
    expect(row?.username).toBe('new');

    const feed = await ctx.app.inject({
      method: 'GET',
      url: '/api/listings?type=TRANSFER',
      headers: ctx.auth(USERS.bob),
    });
    expect(feed.json().items[0].contact.url).toBe('https://t.me/new');
  });

  it('Пользователь удалил username', async () => {
    await ctx.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: ctx.auth({ id: 60, first_name: 'Петя', username: 'petya' }),
    });
    await ctx.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: ctx.auth({ id: 60, first_name: 'Петя' }),
    });
    const row = await ctx.db.user.findUnique({ where: { id: 60n } });
    expect(row?.username).toBeNull();
  });
});

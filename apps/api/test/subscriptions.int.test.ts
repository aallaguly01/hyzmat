import { MAX_SUBSCRIPTIONS } from '@hyzmat/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, USERS, type TestContext } from './helpers/context';
import type { TgUser } from './helpers/initData';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});

const subscribe = (user: TgUser, payload: object) =>
  ctx.app.inject({ method: 'POST', url: '/api/subscriptions', headers: ctx.auth(user), payload });
const list = (user: TgUser) =>
  ctx.app.inject({ method: 'GET', url: '/api/subscriptions', headers: ctx.auth(user) });
const unsubscribe = (user: TgUser, id: string) =>
  ctx.app.inject({ method: 'DELETE', url: `/api/subscriptions/${id}`, headers: ctx.auth(user) });

describe('Подписки', () => {
  it('создание, список, удаление', async () => {
    const res = await subscribe(USERS.alice, { type: 'MAIL', city: ' Балкан ' });
    expect(res.statusCode).toBe(201);
    const sub = res.json();
    expect(sub).toMatchObject({ type: 'MAIL', city: 'Балкан' });

    expect((await list(USERS.alice)).json().items).toEqual([sub]);
    expect((await list(USERS.bob)).json().items).toEqual([]);

    expect((await unsubscribe(USERS.alice, sub.id)).statusCode).toBe(204);
    expect((await list(USERS.alice)).json().items).toEqual([]);
  });

  it('повторная подписка на тот же город (регистр, ё) — та же запись, 200', async () => {
    const first = (await subscribe(USERS.alice, { type: 'MAIL', city: 'Орёл' })).json();
    const again = await subscribe(USERS.alice, { type: 'MAIL', city: 'орел' });
    expect(again.statusCode).toBe(200);
    expect(again.json().id).toBe(first.id);
    // другой тип — отдельная подписка
    expect((await subscribe(USERS.alice, { type: 'TRANSFER', city: 'Орёл' })).statusCode).toBe(201);
  });

  it('лимит подписок', async () => {
    for (let i = 0; i < MAX_SUBSCRIPTIONS; i++) {
      expect((await subscribe(USERS.alice, { type: 'MAIL', city: `Город${i}` })).statusCode).toBe(
        201,
      );
    }
    const res = await subscribe(USERS.alice, { type: 'MAIL', city: 'Лишний' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('SUBSCRIPTION_LIMIT_REACHED');
  });

  it('валидация города и типа', async () => {
    const short = await subscribe(USERS.alice, { type: 'MAIL', city: 'А' });
    expect(short.statusCode).toBe(400);
    expect(short.json().error.details[0].path).toEqual(['city']);
    expect((await subscribe(USERS.alice, { type: 'TAXI', city: 'Балкан' })).statusCode).toBe(400);
  });

  it('чужую подписку удалить нельзя — 404', async () => {
    const sub = (await subscribe(USERS.alice, { type: 'MAIL', city: 'Балкан' })).json();
    expect((await unsubscribe(USERS.bob, sub.id)).statusCode).toBe(404);
    expect((await list(USERS.alice)).json().items).toHaveLength(1);
  });

  it('подписка снимает блокировку бота', async () => {
    await subscribe(USERS.alice, { type: 'MAIL', city: 'Мары' });
    await ctx.db.user.update({
      where: { id: BigInt(USERS.alice.id) },
      data: { botBlockedAt: new Date() },
    });
    await subscribe(USERS.alice, { type: 'MAIL', city: 'Балкан' });
    const user = await ctx.db.user.findUnique({ where: { id: BigInt(USERS.alice.id) } });
    expect(user?.botBlockedAt).toBeNull();
  });

  it('без авторизации — 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/subscriptions' });
    expect(res.statusCode).toBe(401);
  });
});

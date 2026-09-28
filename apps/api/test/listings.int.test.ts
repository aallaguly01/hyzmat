import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, USERS, type TestContext } from './helpers/context';
import type { TgUser } from './helpers/initData';
import { seedListing } from './helpers/seed';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});

// Сегодня в тестах: 2026-09-27
const MAIL = { type: 'MAIL', fromCity: ' Ашхабад ', toCity: 'Москва', departureDate: '2026-10-07' };
const TRANSFER = {
  type: 'TRANSFER',
  fromCity: 'Ашхабад',
  toCity: 'Стамбул',
  amount: '1500',
  conditions: '2%',
};

const post = (user: TgUser, payload: object) =>
  ctx.app.inject({ method: 'POST', url: '/api/listings', headers: ctx.auth(user), payload });
const patch = (user: TgUser, id: string, payload: object) =>
  ctx.app.inject({ method: 'PATCH', url: `/api/listings/${id}`, headers: ctx.auth(user), payload });
const del = (user: TgUser, id: string) =>
  ctx.app.inject({ method: 'DELETE', url: `/api/listings/${id}`, headers: ctx.auth(user) });
const feed = (user: TgUser, query: string) =>
  ctx.app.inject({ method: 'GET', url: `/api/listings?${query}`, headers: ctx.auth(user) });
const mine = (user: TgUser) =>
  ctx.app.inject({ method: 'GET', url: '/api/me/listings', headers: ctx.auth(user) });

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Типы заявок', () => {
  it('Неизвестный тип', async () => {
    const res = await post(USERS.alice, { ...MAIL, type: 'TAXI' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.details[0].path).toEqual(['type']);
  });
});

describe('Создание заявки «Почта»', () => {
  it('Успешное создание', async () => {
    const res = await post(USERS.alice, MAIL);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      type: 'MAIL',
      fromCity: 'Ашхабад',
      toCity: 'Москва',
      departureDate: '2026-10-07',
      author: { id: '1001', username: 'alice', firstName: 'Алиса' },
      contact: { url: 'https://t.me/alice', label: '@alice', kind: 'username' },
      isOwn: true,
    });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).not.toHaveProperty('amount');
  });

  it('Дата в прошлом', async () => {
    const res = await post(USERS.alice, { ...MAIL, departureDate: '2026-09-26' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Дата вылета не может быть в прошлом',
    });
  });

  it('Одинаковые города', async () => {
    const res = await post(USERS.alice, { ...MAIL, toCity: 'ашхабад' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toBe('Города отправления и назначения должны различаться');
  });

  it('Попытка подменить автора', async () => {
    const res = await post(USERS.alice, { ...MAIL, authorId: '1002', author: { id: '1002' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().author.id).toBe('1001');
  });

  it('невалидный JSON', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: { ...ctx.auth(USERS.alice), 'content-type': 'application/json' },
      payload: '{bad',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Создание заявки «Перевод»', () => {
  it('Успешное создание', async () => {
    const res = await post(USERS.alice, TRANSFER);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      type: 'TRANSFER',
      amount: '1500.00',
      currency: 'USD',
      conditions: '2%',
    });
  });

  it('Неположительная сумма', async () => {
    for (const amount of [0, '-5', 'abc']) {
      const res = await post(USERS.alice, { ...TRANSFER, amount });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.details[0].path).toEqual(['amount']);
    }
  });

  it('Клиент передал валюту', async () => {
    const res = await post(USERS.alice, { ...TRANSFER, currency: 'EUR' });
    expect(res.statusCode).toBe(201);
    expect(res.json().currency).toBe('USD');
  });

  it('Поля другого типа', async () => {
    const res = await post(USERS.alice, { ...TRANSFER, departureDate: '2026-10-01' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).not.toHaveProperty('departureDate');
  });

  it('без условий — conditions = null', async () => {
    const { conditions: _c, ...rest } = TRANSFER;
    const res = await post(USERS.alice, rest);
    expect(res.json().conditions).toBeNull();
  });
});

describe('Комментарий к заявке', () => {
  it('Создание с комментарием', async () => {
    const res = await post(USERS.alice, { ...MAIL, comment: '  WhatsApp +99365000000  ' });
    expect(res.statusCode).toBe(201);
    expect(res.json().comment).toBe('WhatsApp +99365000000');
  });

  it('Комментарий у «Перевода»', async () => {
    const res = await post(USERS.alice, { ...TRANSFER, comment: 'Звоните после 18:00' });
    expect(res.statusCode).toBe(201);
    expect(res.json().comment).toBe('Звоните после 18:00');
  });

  it('Без комментария', async () => {
    expect((await post(USERS.alice, MAIL)).json().comment).toBeNull();
    expect((await post(USERS.alice, { ...TRANSFER, comment: '   ' })).json().comment).toBeNull();
  });

  it('Слишком длинный комментарий', async () => {
    const res = await post(USERS.alice, { ...MAIL, comment: 'а'.repeat(301) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.details[0].path).toEqual(['comment']);
  });

  it('Изменение и очистка комментария', async () => {
    for (const base of [MAIL, TRANSFER]) {
      const created = (await post(USERS.alice, base)).json();
      const set = await patch(USERS.alice, created.id, { comment: 'IMO +99365000000' });
      expect(set.statusCode).toBe(200);
      expect(set.json()).toMatchObject({
        comment: 'IMO +99365000000',
        fromCity: created.fromCity,
        toCity: created.toCity,
      });
      const cleared = await patch(USERS.alice, created.id, { comment: null });
      expect(cleared.statusCode).toBe(200);
      expect(cleared.json().comment).toBeNull();
    }
  });

  it('комментарий виден в ленте и в «Моих заявках»', async () => {
    await post(USERS.alice, { ...MAIL, comment: 'Telegram не читаю, пишите в WhatsApp' });
    const item = (await feed(USERS.bob, 'type=MAIL')).json().items[0];
    expect(item.comment).toBe('Telegram не читаю, пишите в WhatsApp');
    expect((await mine(USERS.alice)).json().items[0].comment).toBe(
      'Telegram не читаю, пишите в WhatsApp',
    );
  });
});

describe('Лимиты на создание', () => {
  it('Превышен лимит активных заявок', async () => {
    for (let i = 0; i < 5; i++) {
      await seedListing(ctx.db, USERS.alice, { type: 'TRANSFER' });
    }
    const res = await post(USERS.alice, TRANSFER);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('LISTING_LIMIT_REACHED');
  });

  it('Превышен rate limit', async () => {
    for (let i = 0; i < 5; i++) {
      const created = await post(USERS.alice, TRANSFER);
      expect(created.statusCode).toBe(201);
      if (i < 4) continue;
      // освобождаем место, чтобы упереться именно в rate limit
      await del(USERS.alice, created.json().id);
    }
    const res = await post(USERS.alice, TRANSFER);
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('RATE_LIMITED');
  });

  it('rate limit сбрасывается через час', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await post(USERS.alice, TRANSFER)).json().id);
    for (const id of ids) await del(USERS.alice, id);
    ctx.clock.advance(60 * 60 * 1000 + 1);
    expect((await post(USERS.alice, TRANSFER)).statusCode).toBe(201);
  });

  it('невалидные запросы не расходуют лимит', async () => {
    for (let i = 0; i < 6; i++) await post(USERS.alice, { ...TRANSFER, amount: 0 });
    expect((await post(USERS.alice, TRANSFER)).statusCode).toBe(201);
  });

  it('rate limit считается отдельно для каждого пользователя', async () => {
    for (let i = 0; i < 5; i++) await post(USERS.alice, TRANSFER);
    expect((await post(USERS.bob, TRANSFER)).statusCode).toBe(201);
  });
});

describe('Лента', () => {
  it('Фильтр по типу', async () => {
    await seedListing(ctx.db, USERS.alice, { type: 'MAIL' });
    await seedListing(ctx.db, USERS.alice, { type: 'TRANSFER' });
    const res = await feed(USERS.bob, 'type=MAIL');
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
    expect(res.json().items[0].type).toBe('MAIL');
  });

  it('Тип не передан', async () => {
    const res = await feed(USERS.bob, '');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('Поиск по городу', async () => {
    await seedListing(ctx.db, USERS.alice, {
      type: 'TRANSFER',
      fromCity: 'Ашхабад',
      toCity: 'Стамбул',
    });
    await seedListing(ctx.db, USERS.alice, {
      type: 'TRANSFER',
      fromCity: 'Москва',
      toCity: 'Ашхабад',
    });
    await seedListing(ctx.db, USERS.alice, {
      type: 'TRANSFER',
      fromCity: 'Москва',
      toCity: 'Казань',
    });
    const res = await feed(USERS.bob, `type=TRANSFER&city=${encodeURIComponent('АШХ')}`);
    expect(res.json().items).toHaveLength(2);
  });

  it('поиск нечувствителен к ё/е', async () => {
    await seedListing(ctx.db, USERS.alice, {
      type: 'TRANSFER',
      fromCity: 'Орёл',
      toCity: 'Москва',
    });
    const res = await feed(USERS.bob, `type=TRANSFER&city=${encodeURIComponent('орел')}`);
    expect(res.json().items).toHaveLength(1);
  });

  it('спецсимволы LIKE в запросе не работают как шаблон', async () => {
    await seedListing(ctx.db, USERS.alice, {
      type: 'TRANSFER',
      fromCity: 'Ашхабад',
      toCity: 'Москва',
    });
    const res = await feed(USERS.bob, `type=TRANSFER&city=${encodeURIComponent('%')}`);
    expect(res.json().items).toHaveLength(0);
  });

  it('Скрытие устаревших «Почт»', async () => {
    await seedListing(ctx.db, USERS.alice, { type: 'MAIL', departureDate: '2026-09-26' });
    const today = await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      departureDate: '2026-09-27',
    });
    const res = await feed(USERS.bob, 'type=MAIL');
    expect(res.json().items.map((i: { id: string }) => i.id)).toEqual([today.id]);
  });

  it('Сортировка', async () => {
    const t0 = new Date('2026-09-20T10:00:00Z');
    const later = await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      departureDate: '2026-10-20',
      createdAt: t0,
    });
    const soonOld = await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      departureDate: '2026-10-01',
      createdAt: t0,
    });
    const soonNew = await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      departureDate: '2026-10-01',
      createdAt: new Date('2026-09-21T10:00:00Z'),
    });
    const mailIds = (await feed(USERS.bob, 'type=MAIL'))
      .json()
      .items.map((i: { id: string }) => i.id);
    expect(mailIds).toEqual([soonNew.id, soonOld.id, later.id]);

    const tOld = await seedListing(ctx.db, USERS.alice, { type: 'TRANSFER', createdAt: t0 });
    const tNew = await seedListing(ctx.db, USERS.alice, {
      type: 'TRANSFER',
      createdAt: new Date('2026-09-25T10:00:00Z'),
    });
    const trIds = (await feed(USERS.bob, 'type=TRANSFER'))
      .json()
      .items.map((i: { id: string }) => i.id);
    expect(trIds).toEqual([tNew.id, tOld.id]);
  });

  it.each(['MAIL', 'TRANSFER'] as const)('Пагинация (%s)', async (type) => {
    for (let i = 0; i < 25; i++) {
      await seedListing(ctx.db, USERS.alice, {
        type,
        departureDate: `2026-10-${String(1 + (i % 3)).padStart(2, '0')}`,
        // часть записей с одинаковым createdAt — проверяем tie-break по id
        createdAt: new Date(Date.UTC(2026, 8, 20, 10, 0, i % 5)),
      });
    }
    const first = (await feed(USERS.bob, `type=${type}&limit=20`)).json();
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();

    const second = (
      await feed(USERS.bob, `type=${type}&limit=20&cursor=${encodeURIComponent(first.nextCursor)}`)
    ).json();
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();

    const ids = [...first.items, ...second.items].map((i: { id: string }) => i.id);
    expect(new Set(ids).size).toBe(25);
  });

  it('некорректный курсор', async () => {
    const res = await feed(USERS.bob, 'type=MAIL&cursor=garbage');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('Свои заявки в ленте', async () => {
    await seedListing(ctx.db, USERS.alice, { type: 'TRANSFER' });
    expect((await feed(USERS.alice, 'type=TRANSFER')).json().items[0].isOwn).toBe(true);
    expect((await feed(USERS.bob, 'type=TRANSFER')).json().items[0].isOwn).toBe(false);
  });

  it('автор без username — контакт по id', async () => {
    await seedListing(ctx.db, USERS.noUsername, { type: 'TRANSFER' });
    const item = (await feed(USERS.bob, 'type=TRANSFER')).json().items[0];
    expect(item.contact).toEqual({ url: 'tg://user?id=1003', label: 'Иван', kind: 'id' });
  });
});

describe('Мои заявки', () => {
  it('Только свои', async () => {
    const a = await seedListing(ctx.db, USERS.alice, { type: 'TRANSFER' });
    await seedListing(ctx.db, USERS.bob, { type: 'TRANSFER' });
    const res = await mine(USERS.alice);
    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((i: { id: string }) => i.id)).toEqual([a.id]);
  });

  it('Устаревшая заявка', async () => {
    await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      departureDate: '2026-09-01',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    });
    await seedListing(ctx.db, USERS.alice, { type: 'TRANSFER' });
    const items = (await mine(USERS.alice)).json().items;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: 'TRANSFER', isExpired: false });
    expect(items[1]).toMatchObject({ type: 'MAIL', isExpired: true });
  });
});

describe('Получение одной заявки', () => {
  it('возвращает заявку по id', async () => {
    const l = await seedListing(ctx.db, USERS.alice, { type: 'MAIL' });
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/listings/${l.id}`,
      headers: ctx.auth(USERS.alice),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: l.id, isOwn: true, isExpired: false });
  });

  it('404 для несуществующей', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/listings/${UNKNOWN_ID}`,
      headers: ctx.auth(USERS.alice),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('Редактирование заявки', () => {
  it('Успешное редактирование', async () => {
    const created = (await post(USERS.alice, MAIL)).json();
    ctx.clock.advance(1000);
    const res = await patch(USERS.alice, created.id, { toCity: 'Казань' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      toCity: 'Казань',
      fromCity: 'Ашхабад',
      departureDate: '2026-10-07',
    });
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.updatedAt).getTime(),
    );

    const found = (await feed(USERS.bob, `type=MAIL&city=${encodeURIComponent('казань')}`)).json();
    expect(found.items).toHaveLength(1);
  });

  it('перевод: сумма и очистка условий', async () => {
    const created = (await post(USERS.alice, TRANSFER)).json();
    const res = await patch(USERS.alice, created.id, { amount: '99,5', conditions: '' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ amount: '99.50', conditions: null });
  });

  it('Попытка сменить тип', async () => {
    const created = (await post(USERS.alice, MAIL)).json();
    const res = await patch(USERS.alice, created.id, { type: 'TRANSFER' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TYPE_IMMUTABLE');
  });

  it('Чужая заявка', async () => {
    const created = (await post(USERS.alice, MAIL)).json();
    const res = await patch(USERS.bob, created.id, { toCity: 'Казань' });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    const row = await ctx.db.listing.findUnique({ where: { id: created.id } });
    expect(row?.toCity).toBe('Москва');
  });

  it('Продление устаревшей «Почты»', async () => {
    const l = await seedListing(ctx.db, USERS.alice, { type: 'MAIL', departureDate: '2026-09-01' });
    const res = await patch(USERS.alice, l.id, { departureDate: '2026-10-15' });
    expect(res.statusCode).toBe(200);
    expect(res.json().isExpired).toBe(false);
    expect((await feed(USERS.bob, 'type=MAIL')).json().items).toHaveLength(1);
  });

  it('города после слияния должны различаться', async () => {
    const created = (await post(USERS.alice, MAIL)).json();
    const res = await patch(USERS.alice, created.id, { toCity: 'Ашхабад' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('Несуществующая заявка', async () => {
    const res = await patch(USERS.alice, UNKNOWN_ID, { toCity: 'Казань' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('Удаление заявки', () => {
  it('Успешное удаление', async () => {
    const created = (await post(USERS.alice, TRANSFER)).json();
    const res = await del(USERS.alice, created.id);
    expect(res.statusCode).toBe(204);
    expect((await feed(USERS.bob, 'type=TRANSFER')).json().items).toHaveLength(0);
    expect((await mine(USERS.alice)).json().items).toHaveLength(0);
  });

  it('Чужая заявка', async () => {
    const created = (await post(USERS.alice, TRANSFER)).json();
    const res = await del(USERS.bob, created.id);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    expect(await ctx.db.listing.count()).toBe(1);
  });

  it('Уже удалена', async () => {
    const res = await del(USERS.alice, UNKNOWN_ID);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('Некорректный id', async () => {
    const res = await del(USERS.alice, 'not-a-uuid');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Единый формат ошибок', () => {
  it('Ошибка валидации', async () => {
    const res = await post(USERS.alice, { ...TRANSFER, amount: 'abc' });
    expect(res.statusCode).toBe(400);
    const { error } = res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual([{ path: ['amount'], message: expect.any(String) }]);
  });

  it('Непредвиденная ошибка', async () => {
    ctx.app.get('/api/__boom', async () => {
      throw new Error('secret internal details');
    });
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/__boom',
      headers: ctx.auth(USERS.alice),
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Что-то пошло не так. Попробуйте позже' },
    });
    expect(res.body).not.toContain('secret');
  });

  it('неизвестный маршрут', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/nope',
      headers: ctx.auth(USERS.alice),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

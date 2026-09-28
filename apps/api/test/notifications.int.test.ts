import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, RECLAIM_AFTER_MS } from '../src/modules/notifications/notifications.service';
import {
  BOT_API_KEY,
  BOT_USERNAME,
  createTestContext,
  USERS,
  type TestContext,
} from './helpers/context';
import type { TgUser } from './helpers/initData';
import { seedListing, seedUser } from './helpers/seed';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});

// Сегодня в тестах: 2026-09-27 12:00 UTC
const carol = { id: 1004, first_name: 'Кэрол', username: 'carol' } satisfies TgUser;

const subscribe = (user: TgUser, type: string, city: string) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/subscriptions',
    headers: ctx.auth(user),
    payload: { type, city },
  });

const createMail = (user: TgUser, fromCity: string, toCity: string) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/listings',
    headers: ctx.auth(user),
    payload: { type: 'MAIL', fromCity, toCity, departureDate: '2026-10-15' },
  });

const bot = (url: string, payload?: object) =>
  ctx.app.inject({ method: 'POST', url, headers: { 'x-bot-key': BOT_API_KEY }, payload });

type Item = { id: string; chat_id: string; text: string; reply_markup: unknown };
const claim = async (): Promise<Item[]> => (await bot('/api/bot/outbox/claim')).json().items;
const ack = (payload: object) => bot('/api/bot/outbox/ack', payload);

describe('Уведомление о новой заявке по подписке', () => {
  it('подписчики с подходящим городом получают сообщение со ссылкой на заявку', async () => {
    await subscribe(USERS.alice, 'MAIL', 'Балкан');
    await subscribe(USERS.bob, 'MAIL', 'балк'); // часть названия — как в поиске ленты
    await subscribe(carol, 'MAIL', 'Мары'); // другой город
    const listing = (await createMail(USERS.noUsername, 'Москва', 'Балкан')).json();

    const items = await claim();
    expect(items.map((i) => i.chat_id).sort()).toEqual([
      String(USERS.alice.id),
      String(USERS.bob.id),
    ]);
    expect(items[0]!.text).toContain('🔔 Новая заявка по вашей подписке');
    expect(items[0]!.text).toContain('📦 Почта: Москва → Балкан · 15 окт 2026');
    expect(items[0]!.reply_markup).toEqual({
      inline_keyboard: [
        [{ text: 'Открыть заявку', url: `https://t.me/${BOT_USERNAME}?startapp=l-${listing.id}` }],
      ],
    });
  });

  it('автор, другой тип и заблокировавшие бота — не получают', async () => {
    await subscribe(USERS.alice, 'MAIL', 'Балкан'); // автор
    await subscribe(USERS.bob, 'TRANSFER', 'Балкан'); // другой тип
    await subscribe(carol, 'MAIL', 'Балкан');
    await ctx.db.user.update({
      where: { id: BigInt(carol.id) },
      data: { botBlockedAt: new Date() },
    });

    await createMail(USERS.alice, 'Москва', 'Балкан');
    expect(await claim()).toEqual([]);
  });

  it('несколько подходящих подписок у одного пользователя — одно сообщение', async () => {
    await subscribe(USERS.alice, 'MAIL', 'Москва');
    await subscribe(USERS.alice, 'MAIL', 'Балкан');
    await createMail(USERS.bob, 'Москва', 'Балкан');
    expect(await claim()).toHaveLength(1);
  });

  it('HTML в названиях городов экранируется', async () => {
    await subscribe(USERS.alice, 'MAIL', 'Балкан');
    await createMail(USERS.bob, '<b>Град</b>', 'Балкан');
    const [item] = await claim();
    expect(item!.text).toContain('&lt;b&gt;Град&lt;/b&gt; → Балкан');
  });
});

describe('Выдача и подтверждение (claim / ack)', () => {
  async function enqueue(n: number) {
    await subscribe(USERS.alice, 'MAIL', 'Балкан');
    for (let i = 0; i < n; i++) await createMail(USERS.bob, `Город${i}`, 'Балкан');
  }

  it('выданное не выдаётся повторно, подтверждённое — больше никогда', async () => {
    await enqueue(2);
    const first = await claim();
    expect(first).toHaveLength(2);
    expect(await claim()).toEqual([]);

    await ack({ sent: first.map((i) => i.id) });
    ctx.clock.advance(RECLAIM_AFTER_MS + 1000);
    expect(await claim()).toEqual([]);
  });

  it('не подтверждённое выдаётся снова через 10 минут', async () => {
    await enqueue(1);
    const [item] = await claim();
    ctx.clock.advance(RECLAIM_AFTER_MS - 1000);
    expect(await claim()).toEqual([]);
    ctx.clock.advance(2000);
    expect((await claim()).map((i) => i.id)).toEqual([item!.id]);
  });

  it('временная ошибка — повтор на следующем claim, до MAX_ATTEMPTS раз', async () => {
    await enqueue(1);
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const [item] = await claim();
      expect(item, `попытка ${i + 1}`).toBeDefined();
      await ack({ failed: [{ id: item!.id }] });
    }
    expect(await claim()).toEqual([]);
  });

  it('403 от Telegram — пользователь помечен, его сообщения больше не выдаются', async () => {
    await enqueue(1);
    const [item] = await claim();
    await createMail(USERS.bob, 'Ещё', 'Балкан'); // ещё одно в очереди до ack
    await ack({ failed: [{ id: item!.id, blocked: true }] });

    const alice = await ctx.db.user.findUnique({ where: { id: BigInt(USERS.alice.id) } });
    expect(alice?.botBlockedAt).not.toBeNull();
    ctx.clock.advance(RECLAIM_AFTER_MS + 1000);
    expect(await claim()).toEqual([]);
    // и новые не ставятся
    await createMail(USERS.bob, 'Снова', 'Балкан');
    expect(await claim()).toEqual([]);
  });

  it('сообщение боту в личку снимает блокировку', async () => {
    await seedUser(ctx.db, USERS.alice);
    await ctx.db.user.update({
      where: { id: BigInt(USERS.alice.id) },
      data: { botBlockedAt: new Date() },
    });
    await bot('/api/bot/update', {
      update_id: 1,
      message: { message_id: 1, text: '/start', chat: { id: USERS.alice.id, type: 'private' } },
    });
    const alice = await ctx.db.user.findUnique({ where: { id: BigInt(USERS.alice.id) } });
    expect(alice?.botBlockedAt).toBeNull();
  });

  it('некорректное тело ack — 400', async () => {
    expect((await ack({ sent: ['abc'] })).statusCode).toBe(400);
  });

  it('пачка не больше 40 сообщений', async () => {
    await seedUser(ctx.db, USERS.alice);
    await ctx.db.notification.createMany({
      data: Array.from({ length: 45 }, () => ({ userId: BigInt(USERS.alice.id), text: 'x' })),
    });
    expect(await claim()).toHaveLength(40);
    expect(await claim()).toHaveLength(5);
  });
});

describe('Напоминание накануне выезда', () => {
  const OLD = new Date('2026-09-20T10:00:00Z'); // заявка создана давно

  it('автор MAIL-заявки с выездом завтра получает одно напоминание', async () => {
    await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      fromCity: 'Москва',
      toCity: 'Балкан',
      departureDate: '2026-09-28',
      createdAt: OLD,
    });
    await seedListing(ctx.db, USERS.bob, {
      type: 'MAIL',
      departureDate: '2026-09-29',
      createdAt: OLD,
    });
    await seedListing(ctx.db, USERS.bob, { type: 'TRANSFER', createdAt: OLD });

    const items = await claim();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ chat_id: String(USERS.alice.id) });
    expect(items[0]!.text).toContain('⏰ Завтра выезд по вашей заявке');
    expect(items[0]!.text).toContain('📦 Москва → Балкан');
    expect(items[0]!.reply_markup).toEqual({
      inline_keyboard: [[{ text: 'Мои заявки', url: `https://t.me/${BOT_USERNAME}?startapp=my` }]],
    });

    await ack({ sent: [items[0]!.id] });
    ctx.clock.advance(60 * 60 * 1000);
    expect(await claim()).toEqual([]);
  });

  it('ночью (до 06:00 UTC) не напоминаем', async () => {
    ctx.clock.set('2026-09-27T05:59:00.000Z');
    await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      departureDate: '2026-09-28',
      createdAt: OLD,
    });
    expect(await claim()).toEqual([]);
    ctx.clock.set('2026-09-27T06:00:00.000Z');
    expect(await claim()).toHaveLength(1);
  });

  it('заявка создана меньше 12 часов назад — не напоминаем', async () => {
    await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      departureDate: '2026-09-28',
      createdAt: new Date('2026-09-27T08:00:00Z'),
    });
    expect(await claim()).toEqual([]);
  });

  it('смена даты выезда — напомним ещё раз о новой дате', async () => {
    const l = await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      departureDate: '2026-09-28',
      createdAt: OLD,
    });
    const [item] = await claim();
    await ack({ sent: [item!.id] });

    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/listings/${l.id}`,
      headers: ctx.auth(USERS.alice),
      payload: { departureDate: '2026-09-30' },
    });
    expect(await claim()).toEqual([]);
    ctx.clock.set('2026-09-29T12:00:00.000Z');
    expect(await claim()).toHaveLength(1);
  });

  it('правка без смены даты не сбрасывает напоминание', async () => {
    const l = await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      departureDate: '2026-09-28',
      createdAt: OLD,
    });
    const [item] = await claim();
    await ack({ sent: [item!.id] });
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/listings/${l.id}`,
      headers: ctx.auth(USERS.alice),
      payload: { comment: 'Возьму до 5 кг' },
    });
    expect(await claim()).toEqual([]);
  });
});

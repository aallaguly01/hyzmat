import { beforeEach, describe, expect, it } from 'vitest';
import {
  BOT_API_KEY,
  BOT_USERNAME,
  createTestContext,
  USERS,
  type TestContext,
} from './helpers/context';
import { seedListing } from './helpers/seed';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await createTestContext();
});

// Сегодня в тестах: 2026-09-27
const command = (text: string) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/bot/update',
    headers: { 'x-bot-key': BOT_API_KEY },
    payload: {
      update_id: 1,
      message: { message_id: 5, text, chat: { id: -100, type: 'supergroup' } },
    },
  });

describe('бот: поиск в группе по реальной ленте', () => {
  it('/pochta balkan — только актуальные MAIL в Балкан, по дате выезда', async () => {
    const later = await seedListing(ctx.db, USERS.alice, {
      type: 'MAIL',
      toCity: 'Балкан',
      departureDate: '2026-10-20',
    });
    const sooner = await seedListing(ctx.db, USERS.bob, {
      type: 'MAIL',
      fromCity: 'Балкан',
      departureDate: '2026-10-01',
    });
    await seedListing(ctx.db, USERS.bob, {
      type: 'MAIL',
      toCity: 'Балкан',
      departureDate: '2026-09-20',
    }); // истекла
    await seedListing(ctx.db, USERS.bob, { type: 'TRANSFER', toCity: 'Балкан' });
    await seedListing(ctx.db, USERS.bob, { type: 'MAIL', toCity: 'Мары' });

    const res = await command('/pochta balkan');
    expect(res.statusCode).toBe(200);
    const text: string = res.json().text;
    expect(text).toContain('📦 Почта · Балкан');
    const ids = [...text.matchAll(/startapp=l-([0-9a-f-]{36})/g)].map((m) => m[1]);
    expect(ids).toEqual([sooner.id, later.id]);
    expect(text).toContain(`https://t.me/${BOT_USERNAME}?startapp=l-${sooner.id}`);
  });

  it('больше 5 заявок → 5 строк и «Есть ещё»', async () => {
    for (let i = 0; i < 6; i++) {
      await seedListing(ctx.db, USERS.alice, {
        type: 'TRANSFER',
        fromCity: 'Балкан',
        amount: String(100 + i),
      });
    }
    const text: string = (await command('/perevod Балкан')).json().text;
    expect(text.match(/startapp=l-/g)).toHaveLength(5);
    expect(text).toContain('Есть ещё');
  });
});

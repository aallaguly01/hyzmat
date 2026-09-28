import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerErrorHandling } from '../../plugins/errors';
import type { NotificationsService } from '../notifications/notifications.service';
import { botRoutes } from './bot.routes';
import { WELCOME_TEXT } from './bot.update';

const KEY = 'k'.repeat(48);

function fakeOutbox() {
  return {
    listingCreated: vi.fn(async () => 0),
    enqueueReminders: vi.fn(async () => 0),
    claim: vi.fn(async () => [
      { id: '1', chat_id: '42', text: 'hi', parse_mode: 'HTML' as const, reply_markup: null },
    ]),
    ack: vi.fn(async () => {}),
    unblock: vi.fn(async () => {}),
  } satisfies NotificationsService;
}

function setup(outbox = fakeOutbox()) {
  const app = Fastify({ logger: false });
  registerErrorHandling(app);
  void app.register(
    async (s) =>
      botRoutes(s, {
        apiKey: KEY,
        botUsername: 'hyzmat_bot',
        webappUrl: 'https://example.com',
        search: vi.fn(async () => ({ items: [], hasMore: false })),
        outbox,
      }),
    { prefix: '/api/bot' },
  );
  return app;
}

const update = (text: string, type = 'private') => ({
  update_id: 1,
  message: { message_id: 1, text, chat: { id: 42, type } },
});

describe('/api/bot/*', () => {
  it('ping с верным ключом → 200', async () => {
    const res = await setup().inject({
      method: 'GET',
      url: '/api/bot/ping',
      headers: { 'x-bot-key': KEY },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it.each([
    ['без ключа', {}],
    ['неверный ключ', { 'x-bot-key': 'x'.repeat(48) }],
    ['ключ другой длины', { 'x-bot-key': 'short' }],
  ])('%s → 401', async (_, headers) => {
    const res = await setup().inject({
      method: 'POST',
      url: '/api/bot/update',
      headers,
      payload: update('/start'),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('update /start → метод sendMessage в теле', async () => {
    const res = await setup().inject({
      method: 'POST',
      url: '/api/bot/update',
      headers: { 'x-bot-key': KEY },
      payload: update('/start'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ method: 'sendMessage', chat_id: 42, text: WELCOME_TEXT });
  });

  it('update, на который не отвечаем → {ok:true}', async () => {
    const res = await setup().inject({
      method: 'POST',
      url: '/api/bot/update',
      headers: { 'x-bot-key': KEY },
      payload: update('привет', 'group'),
    });
    expect(res.json()).toEqual({ ok: true });
  });

  it('личное сообщение снимает блокировку, групповое — нет', async () => {
    const outbox = fakeOutbox();
    const app = setup(outbox);
    const post = (payload: object) =>
      app.inject({
        method: 'POST',
        url: '/api/bot/update',
        headers: { 'x-bot-key': KEY },
        payload,
      });
    await post(update('/start'));
    await post(update('/pochta Балкан', 'group'));
    expect(outbox.unblock).toHaveBeenCalledTimes(1);
    expect(outbox.unblock).toHaveBeenCalledWith(42n);
  });

  it('outbox: claim отдаёт пачку, ack передаёт тело', async () => {
    const outbox = fakeOutbox();
    const app = setup(outbox);
    const claim = await app.inject({
      method: 'POST',
      url: '/api/bot/outbox/claim',
      headers: { 'x-bot-key': KEY },
    });
    expect(claim.json().items).toHaveLength(1);
    const body = { sent: ['1'], failed: [] };
    const ack = await app.inject({
      method: 'POST',
      url: '/api/bot/outbox/ack',
      headers: { 'x-bot-key': KEY },
      payload: body,
    });
    expect(ack.statusCode).toBe(200);
    expect(outbox.ack).toHaveBeenCalledWith(body);
  });

  it('outbox без ключа → 401', async () => {
    const res = await setup().inject({ method: 'POST', url: '/api/bot/outbox/claim' });
    expect(res.statusCode).toBe(401);
  });
});

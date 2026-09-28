import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerErrorHandling } from '../../plugins/errors';
import { botRoutes } from './bot.routes';
import { WELCOME_TEXT } from './bot.update';

const KEY = 'k'.repeat(48);

function setup() {
  const app = Fastify({ logger: false });
  registerErrorHandling(app);
  void app.register(
    async (s) =>
      botRoutes(s, {
        apiKey: KEY,
        botUsername: 'hyzmat_bot',
        webappUrl: 'https://example.com',
        search: vi.fn(async () => ({ items: [], hasMore: false })),
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
});

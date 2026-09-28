import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerErrorHandling } from '../../plugins/errors';
import { botRoutes } from './bot.routes';

const KEY = 'k'.repeat(48);

function setup() {
  const app = Fastify({ logger: false });
  registerErrorHandling(app);
  void app.register(async (s) => botRoutes(s, { apiKey: KEY }), { prefix: '/api/bot' });
  return app;
}

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
    const res = await setup().inject({ method: 'GET', url: '/api/bot/ping', headers });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });
});

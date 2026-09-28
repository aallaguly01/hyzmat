import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { unauthorized } from '../../lib/errors';

function keyMatches(header: unknown, key: string) {
  if (typeof header !== 'string') return false;
  const a = Buffer.from(header);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Доступ к /api/bot/* только для Cloudflare Worker бота — по общему ключу `X-Bot-Key`. */
export function registerBotAuth(app: FastifyInstance, apiKey: string) {
  app.addHook('onRequest', async (req) => {
    if (!keyMatches(req.headers['x-bot-key'], apiKey)) {
      throw unauthorized('UNAUTHORIZED', 'Неверный ключ бота');
    }
  });
}

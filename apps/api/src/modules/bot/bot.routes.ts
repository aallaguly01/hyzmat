import type { FastifyInstance } from 'fastify';
import { registerBotAuth } from './bot.auth';

export interface BotOptions {
  /** Общий секрет с Worker (`SERVER_API_KEY` в Worker). */
  apiKey: string;
}

/** API для Cloudflare Worker бота: сервер в РФ недоступен Telegram, поэтому соединения открывает Worker. */
export function botRoutes(app: FastifyInstance, opts: BotOptions) {
  registerBotAuth(app, opts.apiKey);

  app.get('/ping', async () => ({ ok: true }));
}

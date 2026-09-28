import type { FastifyInstance } from 'fastify';
import { registerBotAuth } from './bot.auth';
import { createBotHandler, type BotDeps, type TgUpdate } from './bot.update';

export interface BotOptions extends BotDeps {
  /** Общий секрет с Worker (`SERVER_API_KEY` в Worker). */
  apiKey: string;
}

/** API для Cloudflare Worker бота: сервер в РФ недоступен Telegram, поэтому соединения открывает Worker. */
export function botRoutes(app: FastifyInstance, opts: BotOptions) {
  registerBotAuth(app, opts.apiKey);
  const handleUpdate = createBotHandler(opts);

  app.get('/ping', async () => ({ ok: true }));

  // Worker пересылает сюда апдейт Telegram и возвращает наш ответ как тело webhook-ответа
  app.post('/update', async (req) => (await handleUpdate(req.body as TgUpdate)) ?? { ok: true });
}

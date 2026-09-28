import type { FastifyInstance } from 'fastify';
import type { NotificationsService } from '../notifications/notifications.service';
import { registerBotAuth } from './bot.auth';
import { createBotHandler, type BotDeps, type TgUpdate } from './bot.update';

export interface BotOptions extends BotDeps {
  /** Общий секрет с Worker (`SERVER_API_KEY` в Worker). */
  apiKey: string;
  outbox: NotificationsService;
}

/** API для Cloudflare Worker бота: сервер в РФ недоступен Telegram, поэтому соединения открывает Worker. */
export function botRoutes(app: FastifyInstance, opts: BotOptions) {
  registerBotAuth(app, opts.apiKey);
  const handleUpdate = createBotHandler(opts);

  app.get('/ping', async () => ({ ok: true }));

  // Worker пересылает сюда апдейт Telegram и возвращает наш ответ как тело webhook-ответа
  app.post('/update', async (req) => {
    const update = req.body as TgUpdate;
    const chat = update?.message?.chat;
    // в личке chat.id = id пользователя: раз он пишет боту, уведомления снова доходят
    if (chat?.type === 'private') await opts.outbox.unblock(BigInt(chat.id));
    return (await handleUpdate(update)) ?? { ok: true };
  });

  // уведомления: Worker по cron забирает пачку, отправляет в Telegram и подтверждает
  app.post('/outbox/claim', async () => ({ items: await opts.outbox.claim() }));

  app.post('/outbox/ack', async (req) => {
    await opts.outbox.ack(req.body);
    return { ok: true };
  });
}

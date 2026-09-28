import { PrismaClient } from '@prisma/client';
import { buildApp } from './app';
import { systemClock } from './lib/clock';
import { loadConfig } from './lib/config';
import { createBotApi } from './modules/bot/bot.api';

const config = loadConfig();
const prisma = new PrismaClient();

const botApi = createBotApi(config.BOT_TOKEN);
const bot =
  config.WEBAPP_URL && config.BOT_WEBHOOK_SECRET
    ? { api: botApi, webappUrl: config.WEBAPP_URL, webhookSecret: config.BOT_WEBHOOK_SECRET }
    : undefined;

const app = buildApp({
  prisma,
  clock: systemClock,
  botToken: config.BOT_TOKEN,
  initDataTtlSeconds: config.INIT_DATA_TTL,
  corsOrigin: config.CORS_ORIGIN?.split(',').map((s) => s.trim()),
  logger: { level: config.LOG_LEVEL },
  bot,
});

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.PORT, host: config.HOST });

if (bot) {
  const url = new URL('/api/bot/webhook', bot.webappUrl).toString();
  botApi
    .setWebhook({ url, secret_token: bot.webhookSecret, allowed_updates: ['message'] })
    .then(() => app.log.info({ url }, 'bot: webhook set'))
    .catch((err: unknown) => app.log.error({ err }, 'bot: setWebhook failed'));
}

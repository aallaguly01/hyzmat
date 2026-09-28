import { PrismaClient } from '@prisma/client';
import { buildApp } from './app';
import { systemClock } from './lib/clock';
import { loadConfig } from './lib/config';

const config = loadConfig();
const prisma = new PrismaClient();

const app = buildApp({
  prisma,
  clock: systemClock,
  botToken: config.BOT_TOKEN,
  initDataTtlSeconds: config.INIT_DATA_TTL,
  corsOrigin: config.CORS_ORIGIN?.split(',').map((s) => s.trim()),
  logger: { level: config.LOG_LEVEL },
  bot: config.BOT_API_KEY ? { apiKey: config.BOT_API_KEY } : undefined,
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

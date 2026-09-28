import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import { makeSchemas, MAX_CREATES_PER_HOUR } from '@hyzmat/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Clock } from './lib/clock';
import { createRateLimiter } from './lib/rateLimiter';
import { botRoutes } from './modules/bot/bot.routes';
import type { BotDeps } from './modules/bot/bot.update';
import { listingsRoutes } from './modules/listings/listings.routes';
import { toListingDto } from './modules/listings/listings.mapper';
import { createListingsRepo } from './modules/listings/listings.repo';
import { createListingsService } from './modules/listings/listings.service';
import { createUsersService } from './modules/users/users.service';
import { registerAuth } from './plugins/auth';
import { registerErrorHandling } from './plugins/errors';

export interface AppOptions {
  prisma: PrismaClient;
  clock: Clock;
  botToken: string;
  initDataTtlSeconds: number;
  corsOrigin?: string | string[];
  /** API для Worker бота; без него /api/bot/* не регистрируется. */
  bot?: Omit<BotDeps, 'search'> & { apiKey: string };
  logger?: FastifyServerOptions['logger'];
}

export function buildApp(opts: AppOptions) {
  const app = Fastify({ logger: opts.logger ?? true, trustProxy: true, bodyLimit: 16 * 1024 });

  registerErrorHandling(app);

  if (opts.corsOrigin) {
    void app.register(cors, {
      origin: opts.corsOrigin,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    });
  }

  const users = createUsersService(opts.prisma);
  const listingsRepo = createListingsRepo(opts.prisma);
  const schemas = makeSchemas(opts.clock);
  const listings = createListingsService({
    repo: listingsRepo,
    schemas,
    clock: opts.clock,
    createLimiter: createRateLimiter({
      max: MAX_CREATES_PER_HOUR,
      windowMs: 60 * 60 * 1000,
      now: () => opts.clock.now().getTime(),
    }),
  });

  app.get('/api/health', async () => ({ status: 'ok' }));

  void app.register(
    async (api) => {
      registerAuth(api, {
        botToken: opts.botToken,
        ttlSeconds: opts.initDataTtlSeconds,
        clock: opts.clock,
        users,
      });
      api.get('/me', (req) => users.sync(req.user));
      listingsRoutes(api, listings);
    },
    { prefix: '/api' },
  );

  const bot = opts.bot;
  if (bot) {
    const search: BotDeps['search'] = async (type, city, limit) => {
      const q = schemas.FeedQuery.parse({ type, city, limit });
      const page = await listingsRepo.feed(q, opts.clock.today());
      // viewerId '0' — бот ничей: isOwn всегда false
      return { items: page.items.map((r) => toListingDto(r, '0')), hasMore: !!page.nextCursor };
    };
    void app.register(async (scope) => botRoutes(scope, { ...bot, search }), {
      prefix: '/api/bot',
    });
  }

  return app;
}

import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import { makeSchemas, MAX_CREATES_PER_HOUR } from '@hyzmat/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { Clock } from './lib/clock';
import { createRateLimiter } from './lib/rateLimiter';
import { listingsRoutes } from './modules/listings/listings.routes';
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
  const listings = createListingsService({
    repo: createListingsRepo(opts.prisma),
    schemas: makeSchemas(opts.clock),
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

  return app;
}

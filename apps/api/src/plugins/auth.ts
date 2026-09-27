import type { FastifyInstance } from 'fastify';
import type { UserDto } from '@hyzmat/shared';
import type { Clock } from '../lib/clock';
import { unauthorized } from '../lib/errors';
import { validateInitData } from '../lib/telegram/validateInitData';
import type { UsersService } from '../modules/users/users.service';

declare module 'fastify' {
  interface FastifyRequest {
    user: UserDto;
  }
}

interface AuthOptions {
  botToken: string;
  ttlSeconds: number;
  clock: Clock;
  users: UsersService;
}

/** Авторизация по заголовку `Authorization: tma <initData>` для всех маршрутов текущего скоупа. */
export function registerAuth(app: FastifyInstance, opts: AuthOptions) {
  app.decorateRequest('user', null as unknown as UserDto);

  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('tma ')) {
      throw unauthorized('UNAUTHORIZED', 'Откройте приложение в Telegram');
    }
    req.user = validateInitData(header.slice(4), {
      botToken: opts.botToken,
      ttlSeconds: opts.ttlSeconds,
      nowSeconds: Math.floor(opts.clock.now().getTime() / 1000),
    });

    // username может смениться — синхронизируем на записи и при запросе профиля
    if (req.method !== 'GET' || req.routeOptions.url === '/api/me') {
      req.user = await opts.users.sync(req.user);
    }
  });
}

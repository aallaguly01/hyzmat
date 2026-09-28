import type { PrismaClient, Subscription } from '@prisma/client';
import {
  MAX_SUBSCRIPTIONS,
  normalizeCity,
  SubscriptionInput,
  type SubscriptionDto,
  type UserDto,
} from '@hyzmat/shared';
import { AppError } from '../../lib/errors';
import { parseOrThrow } from '../../lib/validate';

const toDto = (s: Subscription): SubscriptionDto => ({
  id: s.id,
  type: s.type,
  city: s.city,
  createdAt: s.createdAt.toISOString(),
});

const subscriptionNotFound = () => new AppError(404, 'NOT_FOUND', 'Подписка не найдена');

export function createSubscriptionsService(prisma: PrismaClient) {
  return {
    async list(user: UserDto) {
      const rows = await prisma.subscription.findMany({
        where: { userId: BigInt(user.id) },
        orderBy: { createdAt: 'asc' },
      });
      return { items: rows.map(toDto) };
    },

    /** Идемпотентно: повторная подписка на тот же тип и город возвращает существующую. */
    async create(
      body: unknown,
      user: UserDto,
    ): Promise<{ dto: SubscriptionDto; created: boolean }> {
      const input = parseOrThrow(SubscriptionInput, body);
      const userId = BigInt(user.id);
      const cityNorm = normalizeCity(input.city);

      // пользователь снова разрешил писать ему (requestWriteAccess) — снимаем блокировку
      await prisma.user.update({ where: { id: userId }, data: { botBlockedAt: null } });

      const existing = await prisma.subscription.findUnique({
        where: { userId_type_cityNorm: { userId, type: input.type, cityNorm } },
      });
      if (existing) return { dto: toDto(existing), created: false };

      if ((await prisma.subscription.count({ where: { userId } })) >= MAX_SUBSCRIPTIONS) {
        throw new AppError(
          409,
          'SUBSCRIPTION_LIMIT_REACHED',
          `Можно следить не более чем за ${MAX_SUBSCRIPTIONS} городами. Удалите ненужные`,
        );
      }
      const row = await prisma.subscription.create({
        data: { userId, type: input.type, city: input.city, cityNorm },
      });
      return { dto: toDto(row), created: true };
    },

    async remove(id: string, user: UserDto) {
      const { count } = await prisma.subscription.deleteMany({
        where: { id, userId: BigInt(user.id) },
      });
      if (count === 0) throw subscriptionNotFound();
    },
  };
}

export type SubscriptionsService = ReturnType<typeof createSubscriptionsService>;

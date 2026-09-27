import type { PrismaClient } from '@prisma/client';
import type { UserDto } from '@hyzmat/shared';

export function createUsersService(prisma: PrismaClient) {
  return {
    /** Создаёт или обновляет пользователя по данным из валидированной initData. */
    async sync(user: UserDto): Promise<UserDto> {
      const data = { username: user.username, firstName: user.firstName, lastName: user.lastName };
      const row = await prisma.user.upsert({
        where: { id: BigInt(user.id) },
        create: { id: BigInt(user.id), ...data },
        update: data,
      });
      return {
        id: row.id.toString(),
        username: row.username,
        firstName: row.firstName,
        lastName: row.lastName,
      };
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;

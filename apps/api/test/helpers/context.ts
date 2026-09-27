import { PrismaClient } from '@prisma/client';
import { inject } from 'vitest';
import { buildApp } from '../../src/app';
import type { Clock } from '../../src/lib/clock';
import { signInitData, type TgUser } from './initData';

export const BOT_TOKEN = '123456:TEST-TOKEN';

let prisma: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  prisma ??= new PrismaClient({ datasourceUrl: inject('databaseUrl') });
  return prisma;
}

export async function disconnectTestPrisma() {
  await prisma?.$disconnect();
  prisma = undefined;
}

/** Управляемые часы: по умолчанию 2026-09-27 12:00 UTC. */
export function createTestClock(start = '2026-09-27T12:00:00.000Z') {
  let current = new Date(start);
  const clock: Clock & { set: (iso: string) => void; advance: (ms: number) => void } = {
    now: () => new Date(current),
    today: () => current.toISOString().slice(0, 10),
    set: (iso) => {
      current = new Date(iso);
    },
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
  };
  return clock;
}

export const USERS = {
  alice: { id: 1001, first_name: 'Алиса', username: 'alice' },
  bob: { id: 1002, first_name: 'Боб', username: 'bob' },
  noUsername: { id: 1003, first_name: 'Иван' },
} satisfies Record<string, TgUser>;

export async function createTestContext() {
  const db = getTestPrisma();
  await db.$executeRawUnsafe('TRUNCATE TABLE listings, users CASCADE');

  const clock = createTestClock();
  const app = buildApp({
    prisma: db,
    clock,
    botToken: BOT_TOKEN,
    initDataTtlSeconds: 86_400,
    logger: process.env.TEST_LOG ? { level: 'error' } : false,
  });

  const auth = (user: TgUser) => ({
    authorization: `tma ${signInitData({
      botToken: BOT_TOKEN,
      user,
      authDate: Math.floor(clock.now().getTime() / 1000),
    })}`,
  });

  return { app, db, clock, auth };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;

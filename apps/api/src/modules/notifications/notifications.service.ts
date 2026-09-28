import { Prisma, type PrismaClient } from '@prisma/client';
import {
  addDays,
  listingStartParam,
  MY_LISTINGS_START_PARAM,
  type ListingDto,
} from '@hyzmat/shared';
import { z } from 'zod';
import type { Clock } from '../../lib/clock';
import { parseOrThrow } from '../../lib/validate';
import { appLink, listingDetail, routeHtml, type InlineKeyboard } from '../bot/bot.format';
import { toListingDto, type ListingWithAuthor } from '../listings/listings.mapper';

/**
 * Очередь сообщений бота (outbox). Сервер в РФ не может ходить в Telegram, поэтому сообщения
 * складываются в таблицу `notifications`, а Cloudflare Worker раз в минуту забирает их (`claim`),
 * отправляет и сообщает результат (`ack`).
 */

/** Сколько сообщений отдаём Worker за раз: у Worker лимит на подзапросы за вызов. */
export const CLAIM_LIMIT = 40;
/** Попыток доставки, после которых сообщение больше не выдаётся. */
export const MAX_ATTEMPTS = 5;
/** Выданное, но не подтверждённое сообщение снова выдаётся через это время. */
export const RECLAIM_AFTER_MS = 10 * 60 * 1000;
/** Отправленные и брошенные сообщения удаляются через это время. */
export const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
/** Напоминания о выезде — не раньше этого часа UTC (09:00 МСК, 11:00 Ашхабад), не ночью. */
export const REMINDER_HOUR_UTC = 6;
/** Не напоминаем о заявках, созданных совсем недавно: автор и так помнит дату. */
export const REMINDER_MIN_AGE_MS = 12 * 60 * 60 * 1000;

export interface OutboxItem {
  id: string;
  chat_id: string;
  text: string;
  parse_mode: 'HTML';
  reply_markup: InlineKeyboard | null;
}

const Id = z.string().regex(/^\d{1,19}$/, 'Некорректный id');
export const AckBody = z.object({
  sent: z
    .array(Id)
    .max(CLAIM_LIMIT * 2)
    .default([]),
  failed: z
    .array(z.object({ id: Id, blocked: z.boolean().default(false) }))
    .max(CLAIM_LIMIT * 2)
    .default([]),
});

const TYPE_TITLE = { MAIL: '📦 Почта', TRANSFER: '💸 Перевод' } as const;

interface Deps {
  prisma: PrismaClient;
  clock: Clock;
  botUsername: string;
}

export function createNotificationsService({ prisma, clock, botUsername }: Deps) {
  const button = (text: string, param: string): InlineKeyboard => ({
    inline_keyboard: [[{ text, url: appLink(botUsername, param) }]],
  });

  function newListingMessage(l: ListingDto) {
    return {
      text: `🔔 Новая заявка по вашей подписке\n\n${TYPE_TITLE[l.type]}: ${routeHtml(l)} · ${listingDetail(l)}`,
      replyMarkup: button('Открыть заявку', listingStartParam(l.id)),
    };
  }

  /** Напоминание автору MAIL-заявки накануне выезда; атомарно, без дублей. */
  async function enqueueReminders(): Promise<number> {
    const now = clock.now();
    if (now.getUTCHours() < REMINDER_HOUR_UTC) return 0;
    const tomorrow = addDays(clock.today(), 1);
    const createdBefore = new Date(now.getTime() - REMINDER_MIN_AGE_MS);

    const due = await prisma.$queryRaw<{ author_id: bigint; from_city: string; to_city: string }[]>`
      UPDATE listings l SET expiry_notified_at = ${now}
      FROM users u
      WHERE u.id = l.author_id
        AND l.type = 'MAIL'
        AND l.departure_date = ${tomorrow}::date
        AND l.expiry_notified_at IS NULL
        AND l.created_at < ${createdBefore}
        AND u.bot_blocked_at IS NULL
      RETURNING l.author_id, l.from_city, l.to_city`;
    if (due.length === 0) return 0;

    const replyMarkup = button('Мои заявки', MY_LISTINGS_START_PARAM);
    const { count } = await prisma.notification.createMany({
      data: due.map((l) => ({
        userId: l.author_id,
        text:
          `⏰ Завтра выезд по вашей заявке\n\n📦 ${routeHtml({ fromCity: l.from_city, toCity: l.to_city })}\n\n` +
          'Если поездка переносится — измените дату, иначе после завтрашнего дня заявка пропадёт из ленты.',
        replyMarkup: replyMarkup as unknown as Prisma.InputJsonValue,
        createdAt: now,
      })),
    });
    return count;
  }

  return {
    /** Подписчикам с подходящим типом и городом (как в поиске ленты), кроме автора. */
    async listingCreated(row: ListingWithAuthor): Promise<number> {
      const subscribers = await prisma.$queryRaw<{ user_id: bigint }[]>`
        SELECT DISTINCT s.user_id
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        WHERE s.type = ${row.type}::"ListingType"
          AND s.user_id <> ${row.authorId}
          AND u.bot_blocked_at IS NULL
          AND (strpos(${row.fromCityNorm}, s.city_norm) > 0
            OR strpos(${row.toCityNorm}, s.city_norm) > 0)`;
      if (subscribers.length === 0) return 0;

      const { text, replyMarkup } = newListingMessage(toListingDto(row, '0'));
      const { count } = await prisma.notification.createMany({
        data: subscribers.map((s) => ({
          userId: s.user_id,
          text,
          replyMarkup: replyMarkup as unknown as Prisma.InputJsonValue,
          createdAt: clock.now(),
        })),
      });
      return count;
    },

    enqueueReminders,

    /** Выдать Worker пачку сообщений: помечает их выданными, чтобы параллельный вызов не взял те же. */
    async claim(limit = CLAIM_LIMIT): Promise<OutboxItem[]> {
      await enqueueReminders();
      const now = clock.now();
      await prisma.notification.deleteMany({
        where: { createdAt: { lt: new Date(now.getTime() - KEEP_MS) } },
      });

      const reclaimBefore = new Date(now.getTime() - RECLAIM_AFTER_MS);
      const rows = await prisma.$queryRaw<
        { id: bigint; user_id: bigint; text: string; reply_markup: InlineKeyboard | null }[]
      >`
        UPDATE notifications SET claimed_at = ${now}, attempts = attempts + 1
        WHERE id IN (
          SELECT id FROM notifications
          WHERE sent_at IS NULL
            AND attempts < ${MAX_ATTEMPTS}
            AND (claimed_at IS NULL OR claimed_at < ${reclaimBefore})
          ORDER BY id
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, user_id, text, reply_markup`;

      return rows
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .map((r) => ({
          id: r.id.toString(),
          chat_id: r.user_id.toString(),
          text: r.text,
          parse_mode: 'HTML' as const,
          reply_markup: r.reply_markup,
        }));
    },

    /**
     * Результат отправки. `blocked` — Telegram ответил 403 (бот заблокирован или пользователь
     * его не запускал): больше не пишем этому пользователю, пока он снова не подпишется.
     */
    async ack(body: unknown): Promise<void> {
      const { sent, failed } = parseOrThrow(AckBody, body);
      const now = clock.now();
      const ids = (xs: string[]) => xs.map((x) => BigInt(x));
      const blocked = ids(failed.filter((f) => f.blocked).map((f) => f.id));
      const retry = ids(failed.filter((f) => !f.blocked).map((f) => f.id));

      await prisma.$transaction(async (tx) => {
        if (sent.length) {
          await tx.notification.updateMany({
            where: { id: { in: ids(sent) } },
            data: { sentAt: now },
          });
        }
        if (retry.length) {
          await tx.notification.updateMany({
            where: { id: { in: retry }, sentAt: null },
            data: { claimedAt: null },
          });
        }
        if (blocked.length) {
          const users = await tx.notification.findMany({
            where: { id: { in: blocked } },
            select: { userId: true },
            distinct: ['userId'],
          });
          const userIds = users.map((u) => u.userId);
          await tx.user.updateMany({ where: { id: { in: userIds } }, data: { botBlockedAt: now } });
          // остальные сообщения этому пользователю тоже не дойдут — не тратим на них попытки
          await tx.notification.updateMany({
            where: { userId: { in: userIds }, sentAt: null },
            data: { attempts: MAX_ATTEMPTS },
          });
        }
      });
    },

    /** Пользователь написал боту в личку — значит, писать ему снова можно. */
    async unblock(userId: bigint): Promise<void> {
      await prisma.user.updateMany({
        where: { id: userId, botBlockedAt: { not: null } },
        data: { botBlockedAt: null },
      });
    },
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;

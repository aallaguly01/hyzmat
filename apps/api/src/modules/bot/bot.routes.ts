import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { BotApi } from './bot.api';
import { WELCOME_TEXT, welcomeKeyboard } from './bot.messages';

export interface BotOptions {
  api: BotApi;
  webappUrl: string;
  webhookSecret: string;
}

interface Update {
  message?: { text?: string; chat?: { id: number; type: string } };
}

const START = /^\/start(@\w+)?(\s|$)/;

function secretMatches(header: unknown, secret: string) {
  if (typeof header !== 'string') return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook Telegram: на /start отправляет приветствие с кнопкой Mini App. */
export function botRoutes(app: FastifyInstance, opts: BotOptions) {
  app.post('/webhook', async (req, reply) => {
    if (!secretMatches(req.headers['x-telegram-bot-api-secret-token'], opts.webhookSecret)) {
      return reply.code(401).send();
    }

    const msg = (req.body as Update | null)?.message;
    if (msg?.chat?.type === 'private' && msg.text && START.test(msg.text)) {
      try {
        await opts.api.sendMessage({
          chat_id: msg.chat.id,
          text: WELCOME_TEXT,
          reply_markup: welcomeKeyboard(opts.webappUrl),
        });
      } catch (err) {
        // 200 всё равно: иначе Telegram будет бесконечно ретраить апдейт
        req.log.error({ err }, 'bot: sendMessage failed');
      }
    }
    return reply.code(200).send({ ok: true });
  });
}

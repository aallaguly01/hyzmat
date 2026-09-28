import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { WELCOME_TEXT } from './bot.messages';
import { botRoutes } from './bot.routes';

const SECRET = 'test-secret';
const WEBAPP_URL = 'https://example.com';

function setup() {
  const app = Fastify({ logger: false });
  void app.register(async (s) => botRoutes(s, { webappUrl: WEBAPP_URL, webhookSecret: SECRET }), {
    prefix: '/api/bot',
  });
  return (payload: object, secret: string | null = SECRET) =>
    app.inject({
      method: 'POST',
      url: '/api/bot/webhook',
      headers: secret === null ? {} : { 'x-telegram-bot-api-secret-token': secret },
      payload,
    });
}

const update = (text: string, type = 'private') => ({
  update_id: 1,
  message: { message_id: 1, text, chat: { id: 42, type } },
});

describe('bot webhook', () => {
  it('/start → sendMessage с кнопкой Mini App в теле ответа', async () => {
    const res = await setup()(update('/start'));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      method: 'sendMessage',
      chat_id: 42,
      text: WELCOME_TEXT,
      reply_markup: {
        inline_keyboard: [[{ text: 'Понятно, продолжить', web_app: { url: WEBAPP_URL } }]],
      },
    });
  });

  it('/start с deep-link параметром тоже отвечает', async () => {
    const res = await setup()(update('/start ref123'));
    expect(res.json().method).toBe('sendMessage');
  });

  it.each([['wrong'], [null]])('секрет %s → 401', async (secret) => {
    const res = await setup()(update('/start'), secret);
    expect(res.statusCode).toBe(401);
  });

  it.each([
    ['другой текст', update('привет')],
    ['/startx', update('/startx')],
    ['групповой чат', update('/start', 'group')],
    ['апдейт без message', { update_id: 1 }],
  ])('%s → 200 без ответа', async (_, payload) => {
    const res = await setup()(payload);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

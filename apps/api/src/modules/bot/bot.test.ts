import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { createBotApi, type BotApi } from './bot.api';
import { WELCOME_TEXT } from './bot.messages';
import { botRoutes } from './bot.routes';

const SECRET = 'test-secret';
const WEBAPP_URL = 'https://example.com';

function setup(sendMessage: BotApi['sendMessage'] = vi.fn(async () => {})) {
  const api: BotApi = { sendMessage, setWebhook: vi.fn(async () => {}) };
  const app = Fastify({ logger: false });
  void app.register(
    async (s) => botRoutes(s, { api, webappUrl: WEBAPP_URL, webhookSecret: SECRET }),
    {
      prefix: '/api/bot',
    },
  );
  const post = (payload: object, secret: string | null = SECRET) =>
    app.inject({
      method: 'POST',
      url: '/api/bot/webhook',
      headers: secret === null ? {} : { 'x-telegram-bot-api-secret-token': secret },
      payload,
    });
  return { api, post };
}

const update = (text: string, type = 'private') => ({
  update_id: 1,
  message: { message_id: 1, text, chat: { id: 42, type } },
});

describe('bot webhook', () => {
  it('/start → приветствие с кнопкой Mini App', async () => {
    const { api, post } = setup();
    const res = await post(update('/start'));
    expect(res.statusCode).toBe(200);
    expect(api.sendMessage).toHaveBeenCalledWith({
      chat_id: 42,
      text: WELCOME_TEXT,
      reply_markup: {
        inline_keyboard: [[{ text: 'Понятно, продолжить', web_app: { url: WEBAPP_URL } }]],
      },
    });
  });

  it('/start с deep-link параметром тоже отвечает', async () => {
    const { api, post } = setup();
    await post(update('/start ref123'));
    expect(api.sendMessage).toHaveBeenCalledOnce();
  });

  it.each([['wrong'], [null]])('секрет %s → 401', async (secret) => {
    const { api, post } = setup();
    const res = await post(update('/start'), secret);
    expect(res.statusCode).toBe(401);
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it.each([
    ['другой текст', update('привет')],
    ['/startx', update('/startx')],
    ['групповой чат', update('/start', 'group')],
    ['апдейт без message', { update_id: 1 }],
  ])('%s → 200 без ответа', async (_, payload) => {
    const { api, post } = setup();
    const res = await post(payload);
    expect(res.statusCode).toBe(200);
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('ошибка sendMessage не ломает ответ Telegram', async () => {
    const { post } = setup(vi.fn(async () => Promise.reject(new Error('boom'))));
    const res = await post(update('/start'));
    expect(res.statusCode).toBe(200);
  });
});

describe('createBotApi', () => {
  it('шлёт JSON в Bot API', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    await createBotApi('1:T', fetchImpl).sendMessage({ chat_id: 1, text: 'hi' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.telegram.org/bot1:T/sendMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: 1, text: 'hi' }),
    });
  });

  it('ok:false → ошибка с description', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, description: 'Bad Request' }), { status: 400 }),
    );
    await expect(
      createBotApi('1:T', fetchImpl).setWebhook({ url: 'https://x', secret_token: 's' }),
    ).rejects.toThrow('Bot API setWebhook: Bad Request');
  });
});

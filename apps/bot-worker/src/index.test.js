import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import worker, { WELCOME_TEXT } from './index.js';

const env = { WEBAPP_URL: 'https://example.com', WEBHOOK_SECRET: 'test-secret' };

const post = (body, secret = env.WEBHOOK_SECRET) =>
  worker.fetch(
    new Request('https://bot.test/', {
      method: 'POST',
      headers: secret === null ? {} : { 'x-telegram-bot-api-secret-token': secret },
      body: JSON.stringify(body),
    }),
    env,
  );

const update = (text, type = 'private') => ({
  update_id: 1,
  message: { message_id: 1, text, chat: { id: 42, type } },
});

describe('bot worker', () => {
  it('/start → sendMessage с кнопкой Mini App', async () => {
    const res = await post(update('/start'));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      method: 'sendMessage',
      chat_id: 42,
      text: WELCOME_TEXT,
      reply_markup: {
        inline_keyboard: [[{ text: 'Понятно, продолжить', web_app: { url: env.WEBAPP_URL } }]],
      },
    });
  });

  it('/start с deep-link параметром', async () => {
    const res = await post(update('/start ref123'));
    assert.equal((await res.json()).method, 'sendMessage');
  });

  for (const secret of ['wrong-secret', null]) {
    it(`секрет ${secret} → 401`, async () => {
      assert.equal((await post(update('/start'), secret)).status, 401);
    });
  }

  for (const [name, body] of [
    ['другой текст', update('привет')],
    ['/startx', update('/startx')],
    ['групповой чат', update('/start', 'group')],
    ['апдейт без message', { update_id: 1 }],
  ]) {
    it(`${name} → 200 без ответа`, async () => {
      const res = await post(body);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });
    });
  }

  it('GET → 404', async () => {
    const res = await worker.fetch(new Request('https://bot.test/'), env);
    assert.equal(res.status, 404);
  });
});

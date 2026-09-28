import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import worker, { WELCOME_TEXT } from './index.js';

const env = {
  WEBAPP_URL: 'https://example.com',
  SERVER_URL: 'https://api.test',
  WEBHOOK_SECRET: 'test-secret',
  SERVER_API_KEY: 'server-key',
};

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

describe('diag', () => {
  afterEach(() => mock.restoreAll());

  const diag = (key = env.WEBHOOK_SECRET) =>
    worker.fetch(new Request('https://bot.test/diag', { headers: { 'x-diag-key': key } }), env);

  it('без ключа → 401', async () => {
    assert.equal((await diag('nope')).status, 401);
  });

  it('проверяет сервер с X-Bot-Key', async () => {
    const f = mock.method(globalThis, 'fetch', async () => new Response('{"ok":true}'));
    const res = await diag();
    assert.equal(res.status, 200);
    assert.equal((await res.json()).server, 200);
    const [url, init] = f.mock.calls[0].arguments;
    assert.equal(url, 'https://api.test/api/bot/ping');
    assert.equal(init.headers['x-bot-key'], 'server-key');
  });

  it('сервер недоступен → 502 с ошибкой', async () => {
    mock.method(globalThis, 'fetch', async () => Promise.reject(new Error('timeout')));
    const res = await diag();
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /timeout/);
  });
});

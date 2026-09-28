import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import worker, { FALLBACK_TEXT } from './index.js';

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
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
  );

const update = (text, type = 'private') => ({
  update_id: 1,
  message: { message_id: 1, text, chat: { id: 42, type } },
});

const serverReply = { method: 'sendMessage', chat_id: 42, text: 'от сервера' };

afterEach(() => mock.restoreAll());

describe('webhook → сервер', () => {
  it('пересылает апдейт с ключом и возвращает ответ сервера как есть', async () => {
    const f = mock.method(
      globalThis,
      'fetch',
      async () => new Response(JSON.stringify(serverReply)),
    );
    const res = await post(update('/start'));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), serverReply);

    const [url, init] = f.mock.calls[0].arguments;
    assert.equal(url, 'https://api.test/api/bot/update');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['x-bot-key'], 'server-key');
    assert.deepEqual(JSON.parse(init.body), update('/start'));
  });

  for (const secret of ['wrong-secret', null]) {
    it(`секрет ${secret} → 401, на сервер не ходим`, async () => {
      const f = mock.method(globalThis, 'fetch', async () => new Response('{}'));
      assert.equal((await post(update('/start'), secret)).status, 401);
      assert.equal(f.mock.callCount(), 0);
    });
  }

  for (const [name, impl] of [
    ['сервер недоступен', async () => Promise.reject(new Error('timeout'))],
    ['сервер ответил 500', async () => new Response('oops', { status: 500 })],
  ]) {
    it(`${name}: в личке — запасной ответ с кнопкой`, async () => {
      mock.method(globalThis, 'fetch', impl);
      mock.method(console, 'error', () => {});
      const res = await post(update('/start'));
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), {
        method: 'sendMessage',
        chat_id: 42,
        text: FALLBACK_TEXT,
        reply_markup: {
          inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: env.WEBAPP_URL } }]],
        },
      });
    });

    it(`${name}: в группе — молчим`, async () => {
      mock.method(globalThis, 'fetch', impl);
      mock.method(console, 'error', () => {});
      const res = await post(update('/pochta Балкан', 'group'));
      assert.deepEqual(await res.json(), { ok: true });
    });
  }

  it('битое тело при недоступном сервере → 200 {ok:true}', async () => {
    mock.method(globalThis, 'fetch', async () => Promise.reject(new Error('down')));
    mock.method(console, 'error', () => {});
    const res = await post('not json');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  it('GET / и чужие пути → 404', async () => {
    assert.equal((await worker.fetch(new Request('https://bot.test/'), env)).status, 404);
    const other = new Request('https://bot.test/other', { method: 'POST', body: '{}' });
    assert.equal((await worker.fetch(other, env)).status, 404);
  });
});

describe('diag', () => {
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

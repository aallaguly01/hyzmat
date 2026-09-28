import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import worker, { deliver, FALLBACK_TEXT } from './index.js';

const env = {
  WEBAPP_URL: 'https://example.com',
  SERVER_URL: 'https://api.test',
  WEBHOOK_SECRET: 'test-secret',
  SERVER_API_KEY: 'server-key',
  BOT_TOKEN: '1:TOKEN',
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

describe('рассылка уведомлений (cron)', () => {
  const item = (id, chat_id = '100') => ({
    id,
    chat_id,
    text: `msg ${id}`,
    parse_mode: 'HTML',
    reply_markup: null,
  });

  /** fetch-заглушка: claim отдаёт `items`, Telegram отвечает по `tg(chat_id)`, ack запоминается. */
  function mockNetwork(items, tg = () => new Response('{"ok":true}')) {
    const calls = { telegram: [], ack: null };
    mock.method(globalThis, 'fetch', async (url, init) => {
      if (url.endsWith('/api/bot/outbox/claim')) {
        assert.equal(init.headers['x-bot-key'], 'server-key');
        return new Response(JSON.stringify({ items }));
      }
      if (url.endsWith('/api/bot/outbox/ack')) {
        calls.ack = JSON.parse(init.body);
        return new Response('{"ok":true}');
      }
      assert.equal(url, 'https://api.telegram.org/bot1:TOKEN/sendMessage');
      const body = JSON.parse(init.body);
      calls.telegram.push(body);
      return tg(body.chat_id);
    });
    return calls;
  }

  it('пусто — в Telegram не ходим, ack не шлём', async () => {
    const calls = mockNetwork([]);
    assert.deepEqual(await deliver(env), { sent: 0, failed: 0 });
    assert.equal(calls.telegram.length, 0);
    assert.equal(calls.ack, null);
  });

  it('отправляет каждое сообщение без id и подтверждает', async () => {
    const calls = mockNetwork([item('1', '100'), item('2', '200')]);
    assert.deepEqual(await deliver(env), { sent: 2, failed: 0 });
    assert.deepEqual(calls.telegram[0], {
      chat_id: '100',
      text: 'msg 1',
      parse_mode: 'HTML',
      reply_markup: null,
      link_preview_options: { is_disabled: true },
    });
    assert.deepEqual(calls.ack, { sent: ['1', '2'], failed: [] });
  });

  it('403 и «chat not found» — навсегда, 429 и сеть — повторим', async () => {
    const calls = mockNetwork(
      [item('1', 'blocked'), item('2', 'never'), item('3', 'busy'), item('4', 'down')],
      (chat) => {
        if (chat === 'blocked') return new Response('{"ok":false}', { status: 403 });
        if (chat === 'never') {
          return new Response('{"ok":false,"description":"Bad Request: chat not found"}', {
            status: 400,
          });
        }
        if (chat === 'busy') return new Response('{"ok":false}', { status: 429 });
        throw new Error('network');
      },
    );
    assert.deepEqual(await deliver(env), { sent: 0, failed: 4 });
    assert.deepEqual(calls.ack.failed, [
      { id: '1', blocked: true },
      { id: '2', blocked: true },
      { id: '3', blocked: false },
      { id: '4', blocked: false },
    ]);
  });

  it('сервер не отдал очередь — ошибка, в Telegram не ходим', async () => {
    const f = mock.method(globalThis, 'fetch', async () => new Response('down', { status: 502 }));
    await assert.rejects(deliver(env), /claim: 502/);
    assert.equal(f.mock.callCount(), 1);
  });

  it('scheduled передаёт рассылку в waitUntil', async () => {
    mockNetwork([item('1')]);
    mock.method(console, 'log', () => {});
    const waited = [];
    await worker.scheduled({}, env, { waitUntil: (p) => waited.push(p) });
    assert.equal(waited.length, 1);
    await waited[0];
  });
});

/**
 * Cloudflare Worker — webhook Telegram-бота.
 * VPS в РФ недоступен для Telegram (и наоборот), поэтому апдейты принимает Worker.
 * На /start отвечает приветствием с кнопкой Mini App прямо в теле webhook-ответа,
 * так что исходящие запросы к api.telegram.org не нужны.
 *
 * env.WEBAPP_URL, env.SERVER_URL — адреса Mini App и API (vars в wrangler.toml)
 * env.WEBHOOK_SECRET — тот же secret_token, что передан в setWebhook (wrangler secret)
 * env.SERVER_API_KEY — ключ к /api/bot/* на сервере, равен BOT_API_KEY в .env (wrangler secret)
 */

export const WELCOME_TEXT = [
  '👋 Добро пожаловать!',
  'Здесь находят людей для передачи посылок и перевода денег.',
  '⚠️ Важно: Бот — это только площадка для связи. Мы не несем ответственности за ваши деньги, вещи и добросовестность других людей. Все сделки совершаются строго на ваш страх и риск.',
  'Нажимая «Понятно, продолжить», вы принимаете эти условия.',
].join('\n\n');

const START = /^\/start(@\w+)?(\s|$)/;

/** Сравнение без утечки по времени. */
function secretMatches(header, secret) {
  if (!header || !secret || header.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= header.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Доходит ли Worker до сервера: GET /diag с заголовком x-diag-key: <WEBHOOK_SECRET>. */
async function diag(request, env) {
  if (!secretMatches(request.headers.get('x-diag-key'), env.WEBHOOK_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const started = Date.now();
  try {
    const res = await fetch(`${env.SERVER_URL}/api/bot/ping`, {
      headers: { 'x-bot-key': env.SERVER_API_KEY ?? '' },
      signal: AbortSignal.timeout(10_000),
    });
    return json({ server: res.status, body: await res.text(), ms: Date.now() - started });
  } catch (err) {
    return json({ server: null, error: String(err), ms: Date.now() - started }, 502);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/diag') return diag(request, env);
    if (request.method !== 'POST') return new Response('Not found', { status: 404 });
    if (
      !secretMatches(request.headers.get('x-telegram-bot-api-secret-token'), env.WEBHOOK_SECRET)
    ) {
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await request.json().catch(() => null);
    const msg = update?.message;
    if (msg?.chat?.type === 'private' && typeof msg.text === 'string' && START.test(msg.text)) {
      return json({
        method: 'sendMessage',
        chat_id: msg.chat.id,
        text: WELCOME_TEXT,
        reply_markup: {
          inline_keyboard: [[{ text: 'Понятно, продолжить', web_app: { url: env.WEBAPP_URL } }]],
        },
      });
    }
    return json({ ok: true });
  },
};

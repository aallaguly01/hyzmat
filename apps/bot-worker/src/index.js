/**
 * Cloudflare Worker — webhook Telegram-бота.
 * VPS в РФ и Telegram недоступны друг другу, поэтому апдейты принимает Worker и пересылает
 * на сервер (`/api/bot/update`). Ответ сервера (`{ method: 'sendMessage', ... }`) уходит
 * в Telegram телом webhook-ответа. Вся логика бота — на сервере, здесь только прокси.
 *
 * env.WEBAPP_URL, env.SERVER_URL — адреса Mini App и API (vars в wrangler.toml)
 * env.WEBHOOK_SECRET — тот же secret_token, что передан в setWebhook (wrangler secret)
 * env.SERVER_API_KEY — ключ к /api/bot/* на сервере, равен BOT_API_KEY в .env (wrangler secret)
 */

const SERVER_TIMEOUT_MS = 5_000;

export const FALLBACK_TEXT =
  '👋 Сервис временно недоступен, но приложение можно открыть кнопкой ниже.';

/** Сравнение без утечки по времени. */
function secretMatches(header, secret) {
  if (!header || !secret || header.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= header.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

const json = (body, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const toServer = (env, path, init = {}) =>
  fetch(`${env.SERVER_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-bot-key': env.SERVER_API_KEY ?? '' },
    signal: AbortSignal.timeout(SERVER_TIMEOUT_MS),
  });

/** Доходит ли Worker до сервера: GET /diag с заголовком x-diag-key: <WEBHOOK_SECRET>. */
async function diag(request, env) {
  if (!secretMatches(request.headers.get('x-diag-key'), env.WEBHOOK_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const started = Date.now();
  try {
    const res = await toServer(env, '/api/bot/ping');
    return json({ server: res.status, body: await res.text(), ms: Date.now() - started });
  } catch (err) {
    return json({ server: null, error: String(err), ms: Date.now() - started }, 502);
  }
}

/** Сервер недоступен: в личке — кнопка открыть Mini App, в группах молчим. */
function fallback(update, env) {
  const chat = update?.message?.chat;
  if (chat?.type !== 'private') return json({ ok: true });
  return json({
    method: 'sendMessage',
    chat_id: chat.id,
    text: FALLBACK_TEXT,
    reply_markup: {
      inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: env.WEBAPP_URL } }]],
    },
  });
}

async function webhook(request, env) {
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'), env.WEBHOOK_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const body = await request.text();
  try {
    const res = await toServer(env, '/api/bot/update', { method: 'POST', body });
    if (res.ok) return json(await res.text());
    console.error(`server /api/bot/update: ${res.status}`);
  } catch (err) {
    console.error(`server /api/bot/update: ${err}`);
  }
  let update = null;
  try {
    update = JSON.parse(body);
  } catch {
    // битое тело — просто подтверждаем получение
  }
  // 200 всегда: иначе Telegram будет повторять апдейт
  return fallback(update, env);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/diag') return diag(request, env);
    if (request.method === 'POST' && pathname === '/') return webhook(request, env);
    return new Response('Not found', { status: 404 });
  },
};

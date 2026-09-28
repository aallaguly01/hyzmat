/**
 * Cloudflare Worker — webhook Telegram-бота.
 * VPS в РФ и Telegram недоступны друг другу, поэтому апдейты принимает Worker и пересылает
 * на сервер (`/api/bot/update`). Ответ сервера (`{ method: 'sendMessage', ... }`) уходит
 * в Telegram телом webhook-ответа. Вся логика бота — на сервере, здесь только прокси.
 *
 * env.WEBAPP_URL, env.SERVER_URL — адреса Mini App и API (vars в wrangler.toml)
 * env.WEBHOOK_SECRET — тот же secret_token, что передан в setWebhook (wrangler secret)
 * env.SERVER_API_KEY — ключ к /api/bot/* на сервере, равен BOT_API_KEY в .env (wrangler secret)
 * env.BOT_TOKEN — токен бота для рассылки уведомлений по cron (wrangler secret)
 *
 * Уведомления: сервер не может писать в Telegram сам, поэтому раз в минуту (cron) Worker
 * забирает пачку из очереди (`/api/bot/outbox/claim`), отправляет и подтверждает (`/ack`).
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

/** Пауза между сообщениями: лимит Telegram — ~30 сообщений в секунду. */
export const SEND_INTERVAL_MS = 40;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 403 — пользователь заблокировал бота; 400 «chat not found» — никогда его не запускал.
 * Обоим писать бесполезно, остальное (429, 5xx, сеть) — повторим позже.
 */
async function isPermanentFailure(res) {
  if (res.status === 403) return true;
  if (res.status !== 400) return false;
  const body = await res.json().catch(() => null);
  return /chat not found|user is deactivated/i.test(body?.description ?? '');
}

/** Одна рассылка: claim → sendMessage по каждому → ack. */
export async function deliver(env) {
  const res = await toServer(env, '/api/bot/outbox/claim', { method: 'POST', body: '{}' });
  if (!res.ok) throw new Error(`claim: ${res.status}`);
  const { items } = await res.json();
  if (!items.length) return { sent: 0, failed: 0 };

  const sent = [];
  const failed = [];
  for (const [i, item] of items.entries()) {
    if (i > 0) await sleep(SEND_INTERVAL_MS);
    const { id, ...message } = item;
    try {
      const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...message, link_preview_options: { is_disabled: true } }),
      });
      if (tg.ok) sent.push(id);
      else failed.push({ id, blocked: await isPermanentFailure(tg) });
    } catch {
      failed.push({ id, blocked: false });
    }
  }

  const ack = await toServer(env, '/api/bot/outbox/ack', {
    method: 'POST',
    body: JSON.stringify({ sent, failed }),
  });
  if (!ack.ok) throw new Error(`ack: ${ack.status}`);
  return { sent: sent.length, failed: failed.length };
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      deliver(env).then(
        (r) => r.sent + r.failed > 0 && console.log(`outbox: sent ${r.sent}, failed ${r.failed}`),
        (err) => console.error(`outbox: ${err}`),
      ),
    );
  },

  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/diag') return diag(request, env);
    if (request.method === 'POST' && pathname === '/') return webhook(request, env);
    return new Response('Not found', { status: 404 });
  },
};

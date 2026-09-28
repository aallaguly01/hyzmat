/**
 * Cloudflare Worker — webhook Telegram-бота.
 * VPS в РФ недоступен для Telegram (и наоборот), поэтому апдейты принимает Worker.
 * На /start отвечает приветствием с кнопкой Mini App прямо в теле webhook-ответа,
 * так что исходящие запросы к api.telegram.org не нужны.
 *
 * env.WEBAPP_URL — адрес Mini App (vars в wrangler.toml)
 * env.WEBHOOK_SECRET — тот же secret_token, что передан в setWebhook (wrangler secret)
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

export default {
  async fetch(request, env) {
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

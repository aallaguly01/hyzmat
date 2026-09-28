// Оформление бота через Bot API: описание, команды, кнопка меню. Идемпотентно — можно запускать повторно.
// Запуск с машины, где доступен api.telegram.org:
//   PowerShell: $env:BOT_TOKEN="123:ABC"; node setup.mjs
//   bash:       BOT_TOKEN=123:ABC node setup.mjs

const token = process.env.BOT_TOKEN;
const webappUrl = process.env.WEBAPP_URL ?? 'https://aljak.me';
if (!token) {
  console.error('Задайте BOT_TOKEN');
  process.exit(1);
}

// Экран «Что умеет этот бот?» до нажатия «Старт», до 512 символов
const DESCRIPTION = [
  'Здесь находят людей для передачи посылок и перевода денег между городами.',
  '📦 Почта — найти того, кто едет и возьмёт посылку.',
  '💸 Перевод — найти того, кто поможет передать деньги.',
  'Нажмите «Старт», чтобы открыть приложение.',
].join('\n\n');

// Профиль бота и превью при пересылке, до 120 символов
const SHORT_DESCRIPTION =
  'Посылки и переводы денег между городами: найдите попутчика или исполнителя.';

const PRIVATE_COMMANDS = [{ command: 'start', description: 'Открыть приложение' }];

async function call(method, params) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await res.json();
  console.log(`${body.ok ? '✔' : '✖'} ${method}${body.ok ? '' : `: ${body.description}`}`);
  if (!body.ok) process.exitCode = 1;
}

await call('setMyDescription', { description: DESCRIPTION });
await call('setMyShortDescription', { short_description: SHORT_DESCRIPTION });
await call('setMyCommands', {
  commands: PRIVATE_COMMANDS,
  scope: { type: 'all_private_chats' },
});
await call('setChatMenuButton', {
  menu_button: { type: 'web_app', text: 'Открыть', web_app: { url: webappUrl } },
});

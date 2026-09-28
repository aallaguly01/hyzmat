import {
  feedStartParam,
  listingStartParam,
  resolveCityAlias,
  type ListingDto,
  type ListingType,
} from '@hyzmat/shared';
import {
  appLink,
  escapeHtml,
  listingDetail,
  routeHtml,
  type InlineKeyboard,
  type Button,
} from './bot.format';

/** Минимум полей Telegram Update, которые нужны боту. */
export interface TgUpdate {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' };
  };
}

/** Ответ в теле webhook: Telegram выполнит этот метод сам. */
export interface SendMessageReply {
  method: 'sendMessage';
  chat_id: number;
  text: string;
  parse_mode?: 'HTML';
  link_preview_options?: { is_disabled: boolean };
  reply_parameters?: { message_id: number; allow_sending_without_reply: boolean };
  reply_markup?: InlineKeyboard;
}

export interface BotDeps {
  webappUrl: string;
  botUsername: string;
  /** Первые `limit` заявок ленты; `hasMore` — есть ли ещё. */
  search(
    type: ListingType,
    city: string,
    limit: number,
  ): Promise<{ items: ListingDto[]; hasMore: boolean }>;
}

export const SEARCH_LIMIT = 5;

export const WELCOME_TEXT = [
  '👋 Добро пожаловать!',
  'Здесь находят людей для передачи посылок и перевода денег.',
  '⚠️ Важно: Бот — это только площадка для связи. Мы не несем ответственности за ваши деньги, вещи и добросовестность других людей. Все сделки совершаются строго на ваш страх и риск.',
  'Нажимая «Понятно, продолжить», вы принимаете эти условия.',
].join('\n\n');

export const HELP_TEXT = [
  'ℹ️ <b>Как пользоваться</b>',
  'Все заявки — в приложении: откройте его кнопкой ниже или «Открыть» слева от поля ввода.',
  '📦 <b>Почта</b> — кто едет и возьмёт посылку.\n💸 <b>Перевод</b> — кто поможет передать деньги.',
  'Поиск в группах и здесь:\n/pochta Балкан — заявки на почту\n/perevod Ашхабад — заявки на перевод',
].join('\n\n');

export const HINT_TEXT = 'Все заявки — в приложении 👇\nПоиск: /pochta Балкан или /perevod Ашхабад';

const SEARCH_COMMANDS: Record<string, { type: ListingType; title: string }> = {
  pochta: { type: 'MAIL', title: '📦 Почта' },
  perevod: { type: 'TRANSFER', title: '💸 Перевод' },
};

const COMMAND = /^\/([a-z0-9_]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i;

function parseCommand(text: string, botUsername: string) {
  const m = COMMAND.exec(text.trim());
  if (!m) return null;
  const [, name, mention, args] = m;
  // /cmd@other_bot — не нам
  if (mention && mention.toLowerCase() !== botUsername.toLowerCase()) return null;
  return { name: name!.toLowerCase(), args: args?.trim() ?? '' };
}

const listingLine = (l: ListingDto, link: string) =>
  `<a href="${link}">${routeHtml(l)}</a> · ${listingDetail(l)}`;

export function createBotHandler(deps: BotDeps) {
  const link = (param?: string) => appLink(deps.botUsername, param);

  const reply = (
    msg: NonNullable<TgUpdate['message']>,
    text: string,
    buttons: Button[][],
    html = false,
  ): SendMessageReply => ({
    method: 'sendMessage',
    chat_id: msg.chat.id,
    text,
    ...(html ? { parse_mode: 'HTML' as const } : {}),
    link_preview_options: { is_disabled: true },
    // в группе отвечаем на конкретное сообщение, чтобы было понятно кому
    ...(msg.chat.type === 'private'
      ? {}
      : { reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true } }),
    reply_markup: { inline_keyboard: buttons },
  });

  /** В личке — web_app-кнопка; в группах web_app запрещён, там ссылка на Mini App. */
  const openButton = (
    msg: NonNullable<TgUpdate['message']>,
    text: string,
    param?: string,
  ): Button =>
    msg.chat.type === 'private' && !param
      ? { text, web_app: { url: deps.webappUrl } }
      : { text, url: link(param) };

  async function search(msg: NonNullable<TgUpdate['message']>, command: string, args: string) {
    const { type, title } = SEARCH_COMMANDS[command]!;
    if (!args) {
      return reply(msg, `Укажите город: /${command} Балкан`, [
        [openButton(msg, 'Открыть приложение')],
      ]);
    }
    const city = resolveCityAlias(args).slice(0, 64);
    const { items, hasMore } = await deps.search(type, city, SEARCH_LIMIT);
    const feedButton = openButton(msg, 'Все заявки', feedStartParam(type, city));

    if (items.length === 0) {
      return reply(msg, `${title} · ${escapeHtml(city)}\n\nЗаявок пока нет.`, [[feedButton]], true);
    }
    const lines = items.map((l, i) => `${i + 1}. ${listingLine(l, link(listingStartParam(l.id)))}`);
    const more = hasMore ? '\n\nЕсть ещё — смотрите в приложении.' : '';
    return reply(
      msg,
      `${title} · ${escapeHtml(city)}\n\n${lines.join('\n')}${more}`,
      [[feedButton]],
      true,
    );
  }

  return async function handleUpdate(update: TgUpdate): Promise<SendMessageReply | null> {
    const msg = update.message;
    if (!msg || msg.chat.type === 'channel') return null;
    const isPrivate = msg.chat.type === 'private';
    const cmd = msg.text ? parseCommand(msg.text, deps.botUsername) : null;

    if (cmd && SEARCH_COMMANDS[cmd.name]) return search(msg, cmd.name, cmd.args);

    if (cmd?.name === 'start' && isPrivate) {
      return reply(msg, WELCOME_TEXT, [[openButton(msg, 'Понятно, продолжить')]]);
    }
    if (cmd?.name === 'help' || (cmd?.name === 'start' && !isPrivate)) {
      return reply(msg, HELP_TEXT, [[openButton(msg, 'Открыть приложение')]], true);
    }
    // в группе молчим на всё остальное; в личке — подсказка
    if (!isPrivate) return null;
    return reply(msg, HINT_TEXT, [[openButton(msg, 'Открыть приложение')]]);
  };
}

export type BotHandler = ReturnType<typeof createBotHandler>;

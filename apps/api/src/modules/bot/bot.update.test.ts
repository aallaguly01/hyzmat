import type { ListingDto } from '@hyzmat/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  createBotHandler,
  HELP_TEXT,
  HINT_TEXT,
  WELCOME_TEXT,
  type BotDeps,
  type TgUpdate,
} from './bot.update';

const BOT = 'hyzmat_bot';
const APP = 'https://example.com';
const ID = '3f1c2a9e-8b7d-4c6e-9a5b-1d2e3f4a5b6c';
const NBSP = ' ';

const author = { id: '1', username: 'ivan', firstName: 'Иван' };
const base = {
  id: ID,
  comment: null,
  author,
  contact: { url: 'https://t.me/ivan', label: '@ivan', kind: 'username' as const },
  isOwn: false,
  viewCount: 0,
  createdAt: '2026-09-27T12:00:00.000Z',
  updatedAt: '2026-09-27T12:00:00.000Z',
};
const mail: ListingDto = {
  ...base,
  type: 'MAIL',
  fromCity: 'Москва',
  toCity: 'Балкан',
  departureDate: '2026-10-15',
};
const transfer: ListingDto = {
  ...base,
  type: 'TRANSFER',
  fromCity: 'Ашхабад',
  toCity: 'Казань <&>',
  amount: '1500.00',
  currency: 'USD',
  conditions: null,
};

function setup(items: ListingDto[] = [], hasMore = false) {
  const search = vi.fn<BotDeps['search']>(async () => ({ items, hasMore }));
  const handle = createBotHandler({ webappUrl: APP, botUsername: BOT, search });
  return { search, handle };
}

type ChatType = NonNullable<TgUpdate['message']>['chat']['type'];

const msg = (text: string | undefined, type: ChatType = 'private'): TgUpdate => ({
  message: { message_id: 7, ...(text === undefined ? {} : { text }), chat: { id: 42, type } },
});

describe('личка', () => {
  it('/start → приветствие с web_app-кнопкой', async () => {
    const r = await setup().handle(msg('/start'));
    expect(r).toMatchObject({
      method: 'sendMessage',
      chat_id: 42,
      text: WELCOME_TEXT,
      reply_markup: {
        inline_keyboard: [[{ text: 'Понятно, продолжить', web_app: { url: APP } }]],
      },
    });
    expect(r).not.toHaveProperty('reply_parameters');
    expect(r).not.toHaveProperty('parse_mode');
  });

  it('/start с deep-link параметром — то же приветствие', async () => {
    expect((await setup().handle(msg('/start ref123')))?.text).toBe(WELCOME_TEXT);
  });

  it('/help → HTML-справка', async () => {
    const r = await setup().handle(msg('/help'));
    expect(r).toMatchObject({ text: HELP_TEXT, parse_mode: 'HTML' });
  });

  it.each([['привет'], ['/unknown'], [undefined]])('«%s» → подсказка с кнопкой', async (text) => {
    const r = await setup().handle(msg(text));
    expect(r?.text).toBe(HINT_TEXT);
    expect(r?.reply_markup?.inline_keyboard[0]?.[0]).toEqual({
      text: 'Открыть приложение',
      web_app: { url: APP },
    });
  });
});

describe('группа', () => {
  it.each([['/start'], ['/help']])('%s → справка ответом, кнопка-ссылка', async (text) => {
    const r = await setup().handle(msg(text, 'group'));
    expect(r?.text).toBe(HELP_TEXT);
    expect(r?.reply_parameters).toEqual({ message_id: 7, allow_sending_without_reply: true });
    // web_app в группах запрещён — только ссылка
    expect(r?.reply_markup?.inline_keyboard[0]?.[0]).toEqual({
      text: 'Открыть приложение',
      url: `https://t.me/${BOT}?startapp`,
    });
  });

  it.each([['привет'], ['/unknown'], [undefined]])('«%s» → молчим', async (text) => {
    expect(await setup().handle(msg(text, 'group'))).toBeNull();
  });

  it('команда другому боту игнорируется', async () => {
    const { handle, search } = setup([mail]);
    expect(await handle(msg('/pochta@other_bot Балкан', 'group'))).toBeNull();
    expect(search).not.toHaveBeenCalled();
  });

  it('канал игнорируется', async () => {
    expect(await setup().handle(msg('/pochta Балкан', 'channel'))).toBeNull();
  });

  it('апдейт без message', async () => {
    expect(await setup().handle({})).toBeNull();
  });
});

describe('поиск /pochta и /perevod', () => {
  it('/pochta Балкан → список со ссылками и кнопкой «Все заявки»', async () => {
    const { handle, search } = setup([mail]);
    const r = await handle(msg('/pochta Балкан', 'supergroup'));
    expect(search).toHaveBeenCalledWith('MAIL', 'Балкан', 5);
    expect(r?.parse_mode).toBe('HTML');
    expect(r?.text).toContain('📦 Почта · Балкан');
    expect(r?.text).toContain(
      `<a href="https://t.me/${BOT}?startapp=l-${ID}">Москва → Балкан</a> · 15 окт 2026`,
    );
    expect(r?.reply_markup?.inline_keyboard).toEqual([
      [
        {
          text: 'Все заявки',
          url: expect.stringMatching(new RegExp(`^https://t.me/${BOT}\\?startapp=f-MAIL-`)),
        },
      ],
    ]);
  });

  it('@бот в команде и латиница: /pochta@Hyzmat_Bot balkan', async () => {
    const { handle, search } = setup();
    await handle(msg('/pochta@Hyzmat_Bot  balkan ', 'group'));
    expect(search).toHaveBeenCalledWith('MAIL', 'Балкан', 5);
  });

  it('/perevod: сумма и экранирование HTML', async () => {
    const r = await setup([transfer]).handle(msg('/perevod Ашхабад'));
    expect(r?.text).toContain('💸 Перевод · Ашхабад');
    expect(r?.text).toContain(`Ашхабад → Казань &lt;&amp;&gt;</a> · $1${NBSP}500`);
  });

  it('город с HTML экранируется в заголовке', async () => {
    const r = await setup().handle(msg('/pochta <b>x</b>'));
    expect(r?.text).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(r?.text).not.toContain('<b>x');
  });

  it('пусто → «Заявок пока нет»', async () => {
    const r = await setup().handle(msg('/pochta Балкан', 'group'));
    expect(r?.text).toContain('Заявок пока нет');
  });

  it('есть ещё → приписка', async () => {
    const r = await setup([mail], true).handle(msg('/pochta Балкан'));
    expect(r?.text).toContain('Есть ещё');
  });

  it('без города → подсказка, поиск не вызывается', async () => {
    const { handle, search } = setup();
    const r = await handle(msg('/pochta', 'group'));
    expect(r?.text).toBe('Укажите город: /pochta Балкан');
    expect(search).not.toHaveBeenCalled();
  });

  it('длинный город обрезается до 64 символов', async () => {
    const { handle, search } = setup();
    await handle(msg(`/pochta ${'я'.repeat(100)}`));
    expect(search.mock.calls[0]?.[1]).toHaveLength(64);
  });
});

import { act, getDefaultNormalizer, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mailListing, transferListing } from '../../../test/fixtures';
import { intersectionObservers } from '../../../test/io';
import { renderApp, scrollToEnd, tg } from '../../../test/render';
import { apiError, http, HttpResponse, requests, server } from '../../../test/server';

const AMOUNT_1500 = '$1 500';
// сумма содержит неразрывный пробел — сравниваем без схлопывания пробелов
const exact = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };
const feedRequests = () =>
  requests.filter((r) => r.method === 'GET' && r.url.pathname === '/api/listings');

function mockFeed(byType: { MAIL?: unknown[]; TRANSFER?: unknown[] }) {
  server.use(
    http.get('/api/listings', ({ request }) => {
      const type = new URL(request.url).searchParams.get('type') as 'MAIL' | 'TRANSFER';
      return HttpResponse.json({ items: byType[type] ?? [], nextCursor: null });
    }),
  );
}

describe('feed-ui: Навигация по вкладкам', () => {
  it('Старт приложения', async () => {
    renderApp('/');
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /Лента/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('radio', { name: 'Почта' })).toBeChecked();
    expect(screen.getByRole('searchbox')).toHaveValue('');
    await waitFor(() => expect(feedRequests()[0]?.url.searchParams.get('type')).toBe('MAIL'));
  });

  it('Переключение вкладки', async () => {
    const { user } = renderApp('/feed');
    await user.click(screen.getByRole('link', { name: /Мои заявки/ }));
    expect(screen.getByRole('link', { name: /Мои заявки/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(tg().HapticFeedback.selectionChanged).toHaveBeenCalled();
  });
});

describe('feed-ui: Фильтр по типу', () => {
  it('Переключение на «Перевод»', async () => {
    mockFeed({ MAIL: [mailListing()], TRANSFER: [transferListing()] });
    const { user } = renderApp('/feed');
    await screen.findByText('15 окт 2026');
    await user.click(screen.getByRole('radio', { name: 'Перевод' }));
    expect(await screen.findByText(AMOUNT_1500, exact)).toBeInTheDocument();
    expect(screen.queryByText('15 окт 2026')).not.toBeInTheDocument();
    expect(feedRequests().at(-1)?.url.searchParams.get('type')).toBe('TRANSFER');
  });

  it('Возврат на вкладку', async () => {
    mockFeed({ TRANSFER: [transferListing()] });
    const { user } = renderApp('/feed');
    await user.click(screen.getByRole('radio', { name: 'Перевод' }));
    await screen.findByText(AMOUNT_1500, exact);
    await user.click(screen.getByRole('link', { name: /Мои заявки/ }));
    await user.click(screen.getByRole('link', { name: /Лента/ }));
    expect(screen.getByRole('radio', { name: 'Перевод' })).toBeChecked();
    expect(screen.getByText(AMOUNT_1500, exact)).toBeInTheDocument();
    expect(screen.queryByTestId('card-skeleton')).not.toBeInTheDocument();
  });
});

describe('feed-ui: Поиск по городу', () => {
  it('Ввод запроса', async () => {
    const { user } = renderApp('/feed');
    await waitFor(() => expect(feedRequests()).toHaveLength(1));
    await user.type(screen.getByRole('searchbox'), 'моск');
    await waitFor(() => expect(feedRequests().at(-1)?.url.searchParams.get('city')).toBe('моск'));
    const cities = feedRequests().map((r) => r.url.searchParams.get('city'));
    expect(cities).toEqual([null, 'моск']);
  });

  it('Очистка', async () => {
    const { user } = renderApp('/feed');
    await user.type(screen.getByRole('searchbox'), 'моск');
    await waitFor(() => expect(feedRequests().at(-1)?.url.searchParams.get('city')).toBe('моск'));
    await user.click(screen.getByRole('button', { name: 'Очистить' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.queryByText(/ничего не найдено/)).not.toBeInTheDocument();
  });

  it('Ничего не найдено', async () => {
    const { user } = renderApp('/feed');
    await user.type(screen.getByRole('searchbox'), 'моск');
    expect(await screen.findByText('По запросу «моск» ничего не найдено')).toBeInTheDocument();
  });
});

describe('feed-ui: Карточки', () => {
  it('Карточка «Почта»: рендер', async () => {
    mockFeed({ MAIL: [mailListing()] });
    renderApp('/feed');
    const card = await screen.findByRole('article');
    expect(within(card).getByText('Ашхабад')).toBeInTheDocument();
    expect(within(card).getByText('Москва')).toBeInTheDocument();
    expect(within(card).getByText('15 окт 2026')).toBeInTheDocument();
    expect(within(card).getByText('@bob')).toBeInTheDocument();
  });

  it('Карточка «Перевод»: рендер суммы', async () => {
    mockFeed({
      TRANSFER: [transferListing({ amount: '1500.00' }), transferListing({ amount: '99.50' })],
    });
    const { user } = renderApp('/feed');
    await user.click(screen.getByRole('radio', { name: 'Перевод' }));
    expect(await screen.findByText(AMOUNT_1500, exact)).toBeInTheDocument();
    expect(screen.getByText('$99.50')).toBeInTheDocument();
    expect(screen.getAllByText('Комиссия 2%')).toHaveLength(2);
  });

  it('Карточка «Перевод»: без условий', async () => {
    mockFeed({ TRANSFER: [transferListing({ conditions: null })] });
    const { user } = renderApp('/feed');
    await user.click(screen.getByRole('radio', { name: 'Перевод' }));
    await screen.findByText(AMOUNT_1500, exact);
    expect(screen.queryByTestId('listing-conditions')).not.toBeInTheDocument();
  });
});

describe('feed-ui: Комментарий в карточке', () => {
  it('Карточка с комментарием', async () => {
    mockFeed({ MAIL: [mailListing({ comment: 'WhatsApp +99365000000' })] });
    renderApp('/feed');
    const card = await screen.findByRole('article');
    expect(within(card).getByTestId('listing-comment')).toHaveTextContent('WhatsApp +99365000000');
  });

  it('Без комментария', async () => {
    mockFeed({ MAIL: [mailListing({ comment: null })] });
    renderApp('/feed');
    await screen.findByRole('article');
    expect(screen.queryByTestId('listing-comment')).not.toBeInTheDocument();
  });
});

describe('feed-ui: Просмотры', () => {
  const viewRequests = () =>
    requests.filter((r) => r.method === 'POST' && r.url.pathname === '/api/listings/views');
  /** Показать/скрыть карточку с данным городом отправления. */
  const setVisible = (city: string, isIntersecting: boolean) => {
    const article = screen.getByText(city).closest('article');
    const observer = intersectionObservers.find((o) => o.el === article);
    act(() => observer!.cb([{ isIntersecting }]));
  };

  it('Счётчик в стиле Telegram', async () => {
    mockFeed({ MAIL: [mailListing({ viewCount: 1250 })] });
    renderApp('/feed');
    const views = await screen.findByLabelText('Просмотры: 1250');
    expect(views).toHaveTextContent('1.2K');
    expect(views.querySelector('svg')).toBeInTheDocument();
  });

  it('Показ засчитывается после секунды на экране, пачкой и один раз', async () => {
    const a = mailListing({ fromCity: 'Мары' });
    const b = mailListing({ fromCity: 'Дашогуз' });
    const own = mailListing({ fromCity: 'Балканабат', isOwn: true });
    mockFeed({ MAIL: [a, b, own] });
    renderApp('/feed');
    await screen.findByText('Мары');

    vi.useFakeTimers();
    try {
      setVisible('Мары', true);
      setVisible('Дашогуз', true);
      act(() => vi.advanceTimersByTime(500));
      setVisible('Дашогуз', false); // пролистали быстрее секунды — не считается
      expect(intersectionObservers.some((o) => o.el?.textContent?.includes('Балканабат'))).toBe(
        false,
      );
      act(() => vi.advanceTimersByTime(3_000));
      // повторный показ той же карточки в этой сессии не считается
      setVisible('Мары', false);
      setVisible('Мары', true);
      act(() => vi.advanceTimersByTime(3_000));
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() => expect(viewRequests()).toHaveLength(1));
    expect(viewRequests()[0]!.body).toEqual({ ids: [a.id] });
  });
});

describe('feed-ui: Кнопка «Написать»', () => {
  it('Автор с username', async () => {
    mockFeed({ MAIL: [mailListing()] });
    const { user } = renderApp('/feed');
    await user.click(await screen.findByRole('button', { name: 'Написать' }));
    expect(tg().openTelegramLink).toHaveBeenCalledWith('https://t.me/bob');
  });

  it('Автор без username', async () => {
    mockFeed({ MAIL: [mailListing({ author: { id: '7', username: null, firstName: 'Иван' } })] });
    const { user } = renderApp('/feed');
    await user.click(await screen.findByRole('button', { name: 'Написать' }));
    expect(tg().openLink).toHaveBeenCalledWith('tg://user?id=7');
  });

  it('Автор без username: клиент не смог открыть ссылку', async () => {
    tg().openLink.mockImplementation(() => {
      throw new Error('unsupported');
    });
    mockFeed({ MAIL: [mailListing({ author: { id: '7', username: null, firstName: 'Иван' } })] });
    const { user } = renderApp('/feed');
    await user.click(await screen.findByRole('button', { name: 'Написать' }));
    expect(tg().showAlert).toHaveBeenCalledWith(
      'У автора нет @username. Найдите его в Telegram по имени: Иван',
      expect.any(Function),
    );
  });

  it('Своя заявка', async () => {
    mockFeed({ MAIL: [mailListing({ isOwn: true })] });
    renderApp('/feed');
    expect(await screen.findByText('Ваша заявка')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Написать' })).not.toBeInTheDocument();
  });
});

describe('feed-ui: Состояния загрузки', () => {
  it('Первая загрузка', async () => {
    server.use(http.get('/api/listings', () => new Promise(() => {})));
    renderApp('/feed');
    expect(screen.getAllByTestId('card-skeleton')).toHaveLength(3);
  });

  it('Пустая лента', async () => {
    const { user } = renderApp('/feed');
    expect(await screen.findByText('Пока нет заявок. Создайте первую!')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Создать заявку' }));
    expect(await screen.findByText('Что вы предлагаете?')).toBeInTheDocument();
  });

  it('Ошибка сети', async () => {
    let fail = true;
    server.use(
      http.get('/api/listings', () =>
        fail
          ? apiError(500, 'INTERNAL_ERROR', 'Что-то пошло не так')
          : HttpResponse.json({ items: [mailListing()], nextCursor: null }),
      ),
    );
    const { user } = renderApp('/feed');
    expect(await screen.findByText('Что-то пошло не так')).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByRole('article')).toBeInTheDocument();
  });

  it('Бесконечная прокрутка', async () => {
    const page1 = Array.from({ length: 20 }, () => mailListing());
    const page2 = [mailListing({ fromCity: 'Последний' })];
    server.use(
      http.get('/api/listings', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        return HttpResponse.json(
          cursor === 'c1' ? { items: page2, nextCursor: null } : { items: page1, nextCursor: 'c1' },
        );
      }),
    );
    renderApp('/feed');
    expect(await screen.findAllByRole('article')).toHaveLength(20);
    scrollToEnd();
    expect(await screen.findByText('Последний')).toBeInTheDocument();
    expect(feedRequests().at(-1)?.url.searchParams.get('cursor')).toBe('c1');

    const before = feedRequests().length;
    scrollToEnd();
    await new Promise((r) => setTimeout(r, 50));
    expect(feedRequests()).toHaveLength(before);
  });
});

describe('telegram-auth: Передача initData на сервер', () => {
  it('Запрос из Telegram', async () => {
    renderApp('/feed');
    await waitFor(() => expect(feedRequests()).toHaveLength(1));
    expect(feedRequests()[0]?.headers.get('authorization')).toBe(`tma ${tg().initData}`);
  });
});

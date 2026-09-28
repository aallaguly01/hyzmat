import { feedStartParam, listingStartParam } from '@hyzmat/shared';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mailListing, transferListing } from '../../test/fixtures';
import { renderApp, tg } from '../../test/render';
import { apiError, http, HttpResponse, requests, server } from '../../test/server';
import { createTelegramMock, installTelegram } from '../../test/telegramMock';

const scrollIntoView = vi.fn();
beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(() => vi.unstubAllEnvs());

const feedRequests = () =>
  requests.filter((r) => r.method === 'GET' && r.url.pathname === '/api/listings');

const cardOf = (id: string) => document.querySelector(`[data-listing-id="${id}"]`);

/** Лента по типу; `pages` — страницы для курсоров undefined, 'p2', 'p3'… */
function mockFeed(byType: { MAIL?: unknown[][]; TRANSFER?: unknown[][] }) {
  server.use(
    http.get('/api/listings', ({ request }) => {
      const q = new URL(request.url).searchParams;
      const pages = byType[q.get('type') as 'MAIL' | 'TRANSFER'] ?? [[]];
      const i = q.get('cursor') ? Number(q.get('cursor')!.slice(1)) - 1 : 0;
      const next = i + 1 < pages.length ? `p${i + 2}` : null;
      return HttpResponse.json({ items: pages[i] ?? [], nextCursor: next });
    }),
  );
}

function openWith(startParam: string) {
  installTelegram(createTelegramMock({ startParam }));
  return renderApp('/');
}

describe('Ссылка на заявку (startapp=l-<id>)', () => {
  it('открывает ленту нужного типа и подсвечивает заявку', async () => {
    const target = transferListing({ toCity: 'Балкан' });
    server.use(
      http.get('/api/listings/:id', () => HttpResponse.json({ ...target, isExpired: false })),
    );
    mockFeed({ TRANSFER: [[transferListing(), target]] });
    openWith(listingStartParam(target.id));

    await waitFor(() => expect(cardOf(target.id)).toHaveAttribute('data-highlighted', 'true'));
    expect(screen.getByRole('radio', { name: 'Перевод' })).toBeChecked();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // подсветка гаснет
    await waitFor(() => expect(cardOf(target.id)).not.toHaveAttribute('data-highlighted'), {
      timeout: 4000,
    });
  });

  it('заявка на второй странице — догружает ленту', async () => {
    const target = mailListing();
    server.use(
      http.get('/api/listings/:id', () => HttpResponse.json({ ...target, isExpired: false })),
    );
    mockFeed({ MAIL: [[mailListing(), mailListing()], [target]] });
    openWith(listingStartParam(target.id));

    await waitFor(() => expect(cardOf(target.id)).toHaveAttribute('data-highlighted', 'true'));
    expect(feedRequests().map((r) => r.url.searchParams.get('cursor'))).toEqual([null, 'p2']);
  });

  it('заявки нет в ленте — остаётся обычная лента без подсветки', async () => {
    const target = mailListing();
    server.use(
      http.get('/api/listings/:id', () => HttpResponse.json({ ...target, isExpired: false })),
    );
    const other = mailListing();
    mockFeed({ MAIL: [[other]] });
    openWith(listingStartParam(target.id));

    await waitFor(() => expect(cardOf(other.id)).toBeInTheDocument());
    await waitFor(() =>
      expect(requests.some((r) => r.url.pathname.endsWith(target.id))).toBe(true),
    );
    expect(document.querySelector('[data-highlighted]')).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('удалённая заявка → обычная лента', async () => {
    server.use(
      http.get('/api/listings/:id', () => apiError(404, 'NOT_FOUND', 'Заявка не найдена')),
    );
    openWith(listingStartParam('00000000-0000-4000-8000-000000000999'));
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Почта' })).toBeChecked();
  });

  it('истёкшая заявка → тип не переключается, без подсветки', async () => {
    const target = transferListing();
    server.use(
      http.get('/api/listings/:id', () => HttpResponse.json({ ...target, isExpired: true })),
    );
    openWith(listingStartParam(target.id));
    await waitFor(() =>
      expect(requests.some((r) => r.url.pathname.endsWith(target.id))).toBe(true),
    );
    expect(screen.getByRole('radio', { name: 'Почта' })).toBeChecked();
  });

  it('битый start_param игнорируется', async () => {
    openWith('l-garbage');
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
    expect(requests.some((r) => r.url.pathname.startsWith('/api/listings/'))).toBe(false);
  });
});

describe('Ссылка на ленту (startapp=f-<TYPE>-<город>)', () => {
  it('ставит тип и город фильтра', async () => {
    openWith(feedStartParam('TRANSFER', 'Балкан'));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Перевод' })).toBeChecked());
    expect(screen.getByRole('searchbox')).toHaveValue('Балкан');
    await waitFor(() => {
      const q = feedRequests().at(-1)?.url.searchParams;
      expect(q?.get('type')).toBe('TRANSFER');
      expect(q?.get('city')).toBe('Балкан');
    });
  });
});

describe('Поделиться', () => {
  it('без VITE_BOT_USERNAME кнопки нет', async () => {
    vi.stubEnv('VITE_BOT_USERNAME', '');
    mockFeed({ MAIL: [[mailListing()]] });
    renderApp('/feed');
    await screen.findByText('15 окт 2026');
    expect(screen.queryByRole('button', { name: 'Поделиться' })).not.toBeInTheDocument();
  });

  it('открывает диалог Telegram со ссылкой startapp на заявку', async () => {
    vi.stubEnv('VITE_BOT_USERNAME', 'TKMugrat_bot');
    const l = mailListing({ fromCity: 'Москва', toCity: 'Балкан' });
    mockFeed({ MAIL: [[l]] });
    const { user } = renderApp('/feed');
    await user.click(await screen.findByRole('button', { name: 'Поделиться' }));

    const shareUrl = new URL(tg().openTelegramLink.mock.calls.at(-1)![0] as string);
    expect(shareUrl.origin + shareUrl.pathname).toBe('https://t.me/share/url');
    expect(shareUrl.searchParams.get('url')).toBe(`https://t.me/TKMugrat_bot?startapp=l-${l.id}`);
    expect(shareUrl.searchParams.get('text')).toBe('📦 Почта: Москва → Балкан, 15 окт 2026');
  });
});

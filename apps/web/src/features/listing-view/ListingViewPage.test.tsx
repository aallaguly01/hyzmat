import { feedStartParam, listingStartParam } from '@hyzmat/shared';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mailListing, myMail } from '../../../test/fixtures';
import { renderApp, tg } from '../../../test/render';
import { apiError, http, HttpResponse, requests, server } from '../../../test/server';
import { createTelegramMock, installTelegram } from '../../../test/telegramMock';

afterEach(() => vi.unstubAllEnvs());

function mockListing(listing: object) {
  server.use(http.get('/api/listings/:id', () => HttpResponse.json(listing)));
}

const feedRequests = () =>
  requests.filter((r) => r.method === 'GET' && r.url.pathname === '/api/listings');

describe('Ссылка на заявку (startapp=l-<id>)', () => {
  it('открывает страницу заявки, «Написать» ведёт к автору', async () => {
    const l = mailListing({ fromCity: 'Москва', toCity: 'Балкан' });
    mockListing({ ...l, isExpired: false });
    installTelegram(createTelegramMock({ startParam: listingStartParam(l.id) }));
    const { user } = renderApp('/');

    expect(await screen.findByText('Балкан')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Написать' }));
    expect(tg().openTelegramLink).toHaveBeenCalledWith('https://t.me/bob');
  });

  it('«Назад» после входа по ссылке ведёт в ленту', async () => {
    const l = mailListing();
    mockListing({ ...l, isExpired: false });
    renderApp(`/listings/${l.id}`);
    await screen.findByText('15 окт 2026');
    tg().BackButton.click();
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });

  it('удалённая заявка → «не найдена» и кнопка в ленту', async () => {
    server.use(
      http.get('/api/listings/:id', () => apiError(404, 'NOT_FOUND', 'Заявка не найдена')),
    );
    const { user } = renderApp('/listings/00000000-0000-4000-8000-000000000999');
    expect(await screen.findByText('Заявка удалена или не найдена')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'В ленту' }));
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });

  it('истёкшая чужая заявка → «неактуальна»', async () => {
    mockListing({ ...mailListing(), isExpired: true });
    renderApp('/listings/00000000-0000-4000-8000-000000000998');
    expect(await screen.findByText('Эта заявка уже неактуальна')).toBeInTheDocument();
  });

  it('своя заявка → «Редактировать»', async () => {
    const l = myMail();
    mockListing(l);
    const { user } = renderApp(`/listings/${l.id}`);
    await user.click(await screen.findByRole('button', { name: 'Редактировать' }));
    expect(await screen.findByLabelText('Откуда')).toBeInTheDocument();
  });

  it('битый start_param игнорируется — обычная лента', async () => {
    installTelegram(createTelegramMock({ startParam: 'l-garbage' }));
    renderApp('/');
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });
});

describe('Ссылка на ленту (startapp=f-<TYPE>-<город>)', () => {
  it('ставит тип и город фильтра', async () => {
    installTelegram(createTelegramMock({ startParam: feedStartParam('TRANSFER', 'Балкан') }));
    renderApp('/');
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
    mockListing({ ...mailListing(), isExpired: false });
    renderApp('/listings/00000000-0000-4000-8000-000000000997');
    await screen.findByText('15 окт 2026');
    expect(screen.queryByRole('button', { name: 'Поделиться' })).not.toBeInTheDocument();
  });

  it('открывает диалог Telegram со ссылкой startapp на заявку', async () => {
    vi.stubEnv('VITE_BOT_USERNAME', 'hyzmat_bot');
    const l = mailListing({ fromCity: 'Москва', toCity: 'Балкан' });
    mockListing({ ...l, isExpired: false });
    const { user } = renderApp(`/listings/${l.id}`);
    await user.click(await screen.findByRole('button', { name: 'Поделиться' }));

    const shareUrl = new URL(tg().openTelegramLink.mock.calls.at(-1)![0] as string);
    expect(shareUrl.origin + shareUrl.pathname).toBe('https://t.me/share/url');
    expect(shareUrl.searchParams.get('url')).toBe(`https://t.me/hyzmat_bot?startapp=l-${l.id}`);
    expect(shareUrl.searchParams.get('text')).toBe('📦 Почта: Москва → Балкан, 15 окт 2026');
  });

  it('кнопка есть и в ленте', async () => {
    vi.stubEnv('VITE_BOT_USERNAME', 'hyzmat_bot');
    server.use(
      http.get('/api/listings', () =>
        HttpResponse.json({ items: [mailListing()], nextCursor: null }),
      ),
    );
    renderApp('/feed');
    expect(await screen.findByRole('button', { name: 'Поделиться' })).toBeInTheDocument();
  });
});

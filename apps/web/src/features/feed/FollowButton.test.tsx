import type { SubscriptionDto } from '@hyzmat/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, tg } from '../../../test/render';
import { apiError, http, HttpResponse, requests, server } from '../../../test/server';

const sub = (over: Partial<SubscriptionDto> = {}): SubscriptionDto => ({
  id: '00000000-0000-4000-8000-00000000a001',
  type: 'MAIL',
  city: 'Балкан',
  createdAt: '2026-09-27T10:00:00.000Z',
  ...over,
});

/** Сервер подписок в памяти: GET/POST/DELETE как у API. */
function mockSubscriptions(initial: SubscriptionDto[] = []) {
  let items = [...initial];
  server.use(
    http.get('/api/subscriptions', () => HttpResponse.json({ items })),
    http.post('/api/subscriptions', async ({ request }) => {
      const body = (await request.json()) as { type: 'MAIL' | 'TRANSFER'; city: string };
      const created = sub({ id: `00000000-0000-4000-8000-00000000b00${items.length}`, ...body });
      items = [...items, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.delete('/api/subscriptions/:id', ({ params }) => {
      items = items.filter((s) => s.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

const subRequests = (method: string) =>
  requests.filter((r) => r.method === method && r.url.pathname.startsWith('/api/subscriptions'));

describe('Лента: «Следить за городом»', () => {
  it('без города кнопки нет и подписки не запрашиваются', async () => {
    mockSubscriptions();
    renderApp('/feed');
    await screen.findByText('Пока нет заявок. Создайте первую!');
    expect(screen.queryByRole('button', { name: /Следить/ })).not.toBeInTheDocument();
    expect(subRequests('GET')).toHaveLength(0);
  });

  it('подписка: разрешение писать, POST с типом и городом, кнопка переключается', async () => {
    mockSubscriptions();
    const { user } = renderApp('/feed');
    await user.click(screen.getByRole('radio', { name: 'Перевод' }));
    await user.type(screen.getByRole('searchbox'), 'Балкан');

    await user.click(await screen.findByRole('button', { name: '🔔 Следить за «Балкан»' }));
    expect(tg().requestWriteAccess).toHaveBeenCalled();
    await waitFor(() =>
      expect(subRequests('POST')[0]?.body).toEqual({ type: 'TRANSFER', city: 'Балкан' }),
    );
    const btn = await screen.findByRole('button', { name: '🔕 Не следить за «Балкан»' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(tg().HapticFeedback.notificationOccurred).toHaveBeenCalledWith('success');
  });

  it('уже подписан (другой регистр) — «Не следить», отписка DELETE', async () => {
    mockSubscriptions([sub({ city: 'балкан' })]);
    const { user } = renderApp('/feed');
    await user.type(screen.getByRole('searchbox'), 'Балкан');
    await user.click(await screen.findByRole('button', { name: '🔕 Не следить за «Балкан»' }));
    await waitFor(() => expect(subRequests('DELETE')).toHaveLength(1));
    expect(
      await screen.findByRole('button', { name: '🔔 Следить за «Балкан»' }),
    ).toBeInTheDocument();
  });

  it('подписка на другой тип не считается', async () => {
    mockSubscriptions([sub({ type: 'TRANSFER' })]);
    const { user } = renderApp('/feed');
    await user.type(screen.getByRole('searchbox'), 'Балкан');
    expect(
      await screen.findByRole('button', { name: '🔔 Следить за «Балкан»' }),
    ).toBeInTheDocument();
  });

  it('отказ в разрешении — подсказка, подписка не создаётся', async () => {
    mockSubscriptions();
    tg().denyWriteAccess();
    const { user } = renderApp('/feed');
    await user.type(screen.getByRole('searchbox'), 'Балкан');
    await user.click(await screen.findByRole('button', { name: /Следить за/ }));
    await waitFor(() =>
      expect(tg().showAlert).toHaveBeenCalledWith(
        'Разрешите боту писать вам — иначе уведомления не придут',
        expect.any(Function),
      ),
    );
    expect(subRequests('POST')).toHaveLength(0);
  });

  it('лимит подписок — сообщение сервера', async () => {
    mockSubscriptions();
    server.use(
      http.post('/api/subscriptions', () =>
        apiError(409, 'SUBSCRIPTION_LIMIT_REACHED', 'Можно следить не более чем за 10 городами'),
      ),
    );
    const { user } = renderApp('/feed');
    await user.type(screen.getByRole('searchbox'), 'Балкан');
    await user.click(await screen.findByRole('button', { name: /Следить за/ }));
    await waitFor(() =>
      expect(tg().showAlert).toHaveBeenCalledWith(
        'Можно следить не более чем за 10 городами',
        expect.any(Function),
      ),
    );
  });
});

describe('Мои заявки: блок подписок', () => {
  it('нет подписок — блока нет', async () => {
    mockSubscriptions();
    renderApp('/my');
    await screen.findByText('У вас пока нет заявок');
    expect(screen.queryByText(/Уведомления о новых заявках/)).not.toBeInTheDocument();
  });

  it('список и удаление', async () => {
    mockSubscriptions([
      sub(),
      sub({ id: '00000000-0000-4000-8000-00000000a002', type: 'TRANSFER', city: 'Ашхабад' }),
    ]);
    const { user } = renderApp('/my');
    const section = await screen.findByRole('region', { name: /Уведомления о новых заявках/ });
    expect(within(section).getByText('📦 Почта · Балкан')).toBeInTheDocument();
    expect(within(section).getByText('💸 Перевод · Ашхабад')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Не следить: Почта, Балкан' }));
    await waitFor(() => expect(within(section).queryByText('📦 Почта · Балкан')).toBeNull());
    expect(subRequests('DELETE')[0]?.url.pathname).toBe(
      '/api/subscriptions/00000000-0000-4000-8000-00000000a001',
    );
  });
});

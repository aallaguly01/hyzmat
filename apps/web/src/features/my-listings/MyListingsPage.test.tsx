import { screen, waitFor, within } from '@testing-library/react';
import type { MyListingDto } from '@hyzmat/shared';
import { describe, expect, it } from 'vitest';
import { myMail, myTransfer } from '../../../test/fixtures';
import { renderApp, tg } from '../../../test/render';
import { apiError, http, HttpResponse, requests, server } from '../../../test/server';

function mockMine(items: MyListingDto[]) {
  server.use(http.get('/api/me/listings', () => HttpResponse.json({ items })));
}
const deleteRequests = () => requests.filter((r) => r.method === 'DELETE');

describe('my-listings-ui: Список своих заявок', () => {
  it('Есть заявки', async () => {
    mockMine([myMail(), myTransfer()]);
    renderApp('/my');
    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText('Почта')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('Перевод')).toBeInTheDocument();
    for (const card of cards) {
      expect(within(card).getByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'Удалить' })).toBeInTheDocument();
      expect(within(card).queryByRole('button', { name: 'Написать' })).not.toBeInTheDocument();
    }
  });

  it('Устаревшая заявка', async () => {
    mockMine([myMail({ isExpired: true })]);
    renderApp('/my');
    const card = await screen.findByRole('article');
    expect(within(card).getByText('Истекла')).toBeInTheDocument();
    expect(
      within(card).getByText('Не показывается в ленте. Измените дату, чтобы продлить'),
    ).toBeInTheDocument();
    expect(card).toHaveAttribute('data-expired', 'true');
  });

  it('Нет заявок', async () => {
    const { user } = renderApp('/my');
    expect(await screen.findByText('У вас пока нет заявок')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Создать заявку' }));
    expect(await screen.findByText('Что вы предлагаете?')).toBeInTheDocument();
  });

  it('Ошибка загрузки', async () => {
    server.use(http.get('/api/me/listings', () => apiError(500, 'INTERNAL_ERROR', 'Сбой')));
    renderApp('/my');
    expect(await screen.findByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});

describe('my-listings-ui: Создание заявки (FAB)', () => {
  it('Нажатие FAB', async () => {
    mockMine([myMail()]);
    const { user } = renderApp('/my');
    await screen.findByRole('article');
    await user.click(screen.getByRole('button', { name: '+ Создать заявку' }));
    expect(await screen.findByText('Что вы предлагаете?')).toBeInTheDocument();
  });

  it('Достигнут лимит', async () => {
    mockMine([myMail(), myMail(), myMail(), myTransfer(), myTransfer()]);
    const { user } = renderApp('/my');
    await screen.findAllByRole('article');
    const fab = screen.getByRole('button', { name: '+ Создать заявку' });
    expect(fab).toHaveAttribute('aria-disabled', 'true');
    await user.click(fab);
    expect(tg().showAlert).toHaveBeenCalledWith(
      'Можно иметь не более 5 заявок. Удалите ненужные.',
      expect.any(Function),
    );
    expect(screen.queryByText('Что вы предлагаете?')).not.toBeInTheDocument();
  });
});

describe('my-listings-ui: Редактирование', () => {
  it('Открытие формы', async () => {
    const l = myMail({ toCity: 'Казань' });
    mockMine([l]);
    const { user } = renderApp('/my');
    await user.click(await screen.findByRole('button', { name: 'Редактировать' }));
    expect(await screen.findByLabelText('Куда')).toHaveValue('Казань');
    // данные из кэша списка — отдельный запрос заявки не нужен
    expect(requests.some((r) => r.url.pathname === `/api/listings/${l.id}`)).toBe(false);
  });
});

describe('my-listings-ui: Удаление', () => {
  it('Подтверждённое удаление', async () => {
    const l = myMail();
    mockMine([l]);
    server.use(http.delete(`/api/listings/${l.id}`, () => new HttpResponse(null, { status: 204 })));
    const { user } = renderApp('/my');
    await user.click(await screen.findByRole('button', { name: 'Удалить' }));
    expect(tg().showConfirm).toHaveBeenCalledWith('Удалить заявку?', expect.any(Function));
    await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument());
    await waitFor(() => expect(deleteRequests()).toHaveLength(1));
    await waitFor(() =>
      expect(tg().HapticFeedback.notificationOccurred).toHaveBeenCalledWith('success'),
    );
  });

  it('Отмена', async () => {
    mockMine([myMail()]);
    tg().answerConfirm(false);
    const { user } = renderApp('/my');
    await user.click(await screen.findByRole('button', { name: 'Удалить' }));
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(deleteRequests()).toHaveLength(0);
  });

  it('Ошибка удаления', async () => {
    const l = myMail();
    mockMine([l]);
    server.use(
      http.delete(`/api/listings/${l.id}`, () => apiError(500, 'INTERNAL_ERROR', 'Сбой сервера')),
    );
    const { user } = renderApp('/my');
    await user.click(await screen.findByRole('button', { name: 'Удалить' }));
    await waitFor(() =>
      expect(tg().showAlert).toHaveBeenCalledWith('Сбой сервера', expect.any(Function)),
    );
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(tg().HapticFeedback.notificationOccurred).toHaveBeenCalledWith('error');
  });

  it('Уже удалена', async () => {
    const l = myMail();
    mockMine([l]);
    server.use(
      http.delete(`/api/listings/${l.id}`, () => apiError(404, 'NOT_FOUND', 'Заявка не найдена')),
    );
    const { user } = renderApp('/my');
    await user.click(await screen.findByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(deleteRequests()).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(tg().showAlert).not.toHaveBeenCalled();
  });

  it('Повторное нажатие', async () => {
    const l = myMail();
    mockMine([l]);
    // подтверждение «висит» — пользователь ещё не ответил
    let answer: ((ok: boolean) => void) | undefined;
    tg().showConfirm.mockImplementation((_m, cb) => {
      answer = cb;
    });
    const { user } = renderApp('/my');
    const btn = await screen.findByRole('button', { name: 'Удалить' });
    await user.click(btn);
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(tg().showConfirm).toHaveBeenCalledTimes(1);
    answer?.(false);
    await waitFor(() => expect(btn).toBeEnabled());
  });
});

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { MyListingDto } from '@hyzmat/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mailListing, myMail, myTransfer, transferListing } from '../../../test/fixtures';
import { renderApp, tg } from '../../../test/render';
import { apiError, http, HttpResponse, requests, server } from '../../../test/server';
import { installTelegram, createTelegramMock } from '../../../test/telegramMock';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-27T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const mb = () => tg().MainButton;
const writes = () => requests.filter((r) => r.method === 'POST' || r.method === 'PATCH');

async function openMailForm() {
  const ctx = renderApp('/listings/new');
  await ctx.user.click(await screen.findByRole('button', { name: /Почта/ }));
  return ctx;
}

async function fillMail(user: ReturnType<typeof renderApp>['user']) {
  await user.type(screen.getByLabelText('Откуда'), 'Ашхабад');
  await user.type(screen.getByLabelText('Куда'), 'Москва');
  fireEvent.change(screen.getByLabelText('Дата вылета'), { target: { value: '2026-10-15' } });
}

function mockMine(items: MyListingDto[]) {
  server.use(http.get('/api/me/listings', () => HttpResponse.json({ items })));
}

describe('listing-form-ui: Выбор типа', () => {
  it('шаг выбора типа: MainButton скрыта, нижней панели нет', async () => {
    renderApp('/listings/new');
    expect(await screen.findByText('Что вы предлагаете?')).toBeInTheDocument();
    expect(mb().isVisible).toBe(false);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('Выбор «Почта»', async () => {
    await openMailForm();
    expect(screen.getByLabelText('Откуда')).toBeInTheDocument();
    expect(screen.getByLabelText('Куда')).toBeInTheDocument();
    expect(screen.getByLabelText('Дата вылета')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Дата вылета')).toHaveAttribute('min', '2026-09-27');
    expect(mb().isVisible).toBe(true);
    expect(mb().text).toBe('Опубликовать');
  });

  it('Выбор «Перевод»', async () => {
    const { user } = renderApp('/listings/new');
    await user.click(await screen.findByRole('button', { name: /Перевод/ }));
    expect(screen.getByLabelText('Город, где отдаю деньги')).toBeInTheDocument();
    expect(screen.getByLabelText('Город, где получат деньги')).toBeInTheDocument();
    expect(screen.getByLabelText('Сумма, $')).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByLabelText('Условия/Комиссия')).toBeInTheDocument();
  });

  it('Смена типа на шаге 2', async () => {
    const { user } = await openMailForm();
    await user.type(screen.getByLabelText('Откуда'), 'Ашхабад');
    act(() => tg().BackButton.click());
    expect(await screen.findByText('Что вы предлагаете?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Почта/ }));
    expect(screen.getByLabelText('Откуда')).toHaveValue('');
  });
});

describe('listing-form-ui: Валидация на клиенте', () => {
  it('Невалидная форма', async () => {
    await openMailForm();
    expect(mb().isVisible).toBe(true);
    expect(mb().isActive).toBe(false);
  });

  it('Валидная форма', async () => {
    const { user } = await openMailForm();
    await fillMail(user);
    await waitFor(() => expect(mb().isActive).toBe(true));
  });

  it('ошибка показывается после blur', async () => {
    const { user } = await openMailForm();
    await user.type(screen.getByLabelText('Откуда'), 'А');
    expect(screen.queryByText('Минимум 2 символа')).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByText('Минимум 2 символа')).toBeInTheDocument();
  });

  it('Дата в прошлом', async () => {
    const { user } = await openMailForm();
    await user.type(screen.getByLabelText('Откуда'), 'Ашхабад');
    await user.type(screen.getByLabelText('Куда'), 'Москва');
    const date = screen.getByLabelText('Дата вылета');
    fireEvent.change(date, { target: { value: '2026-09-20' } });
    fireEvent.blur(date);
    expect(screen.getByText('Дата вылета не может быть в прошлом')).toBeInTheDocument();
    expect(mb().isActive).toBe(false);
  });

  it('Сумма с запятой', async () => {
    const { user } = renderApp('/listings/new');
    await user.click(await screen.findByRole('button', { name: /Перевод/ }));
    await user.type(screen.getByLabelText('Город, где отдаю деньги'), 'Ашхабад');
    await user.type(screen.getByLabelText('Город, где получат деньги'), 'Стамбул');
    await user.type(screen.getByLabelText('Сумма, $'), '1500,5');
    await waitFor(() => expect(mb().isActive).toBe(true));
  });
});

describe('listing-form-ui: Публикация через MainButton', () => {
  it('Успешная публикация', async () => {
    const created = myMail({ fromCity: 'Ашхабад', toCity: 'Москва' });
    let mine: MyListingDto[] = [];
    server.use(
      http.post('/api/listings', () => {
        mine = [created];
        return HttpResponse.json(created, { status: 201 });
      }),
      http.get('/api/me/listings', () => HttpResponse.json({ items: mine })),
    );
    const { user } = await openMailForm();
    await fillMail(user);
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => mb().click());
    expect(mb().showProgress).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Мои заявки/ })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
    expect(writes()[0]?.body).toEqual({
      type: 'MAIL',
      fromCity: 'Ашхабад',
      toCity: 'Москва',
      departureDate: '2026-10-15',
    });
    expect(tg().HapticFeedback.notificationOccurred).toHaveBeenCalledWith('success');
    expect(await screen.findByRole('article')).toBeInTheDocument();
    expect(mb().isProgressVisible).toBe(false);
  });

  it('публикация перевода: сумма нормализуется', async () => {
    server.use(http.post('/api/listings', () => HttpResponse.json(myTransfer(), { status: 201 })));
    const { user } = renderApp('/listings/new');
    await user.click(await screen.findByRole('button', { name: /Перевод/ }));
    await user.type(screen.getByLabelText('Город, где отдаю деньги'), 'Ашхабад');
    await user.type(screen.getByLabelText('Город, где получат деньги'), 'Стамбул');
    await user.type(screen.getByLabelText('Сумма, $'), '1500,5');
    await user.type(screen.getByLabelText('Условия/Комиссия'), '2%');
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => mb().click());
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]?.body).toEqual({
      type: 'TRANSFER',
      fromCity: 'Ашхабад',
      toCity: 'Стамбул',
      amount: '1500.50',
      conditions: '2%',
    });
  });

  it('Двойное нажатие', async () => {
    let resolve: (() => void) | undefined;
    server.use(
      http.post(
        '/api/listings',
        () =>
          new Promise<Response>((r) => {
            resolve = () => r(HttpResponse.json(myMail(), { status: 201 }));
          }),
      ),
    );
    const { user } = await openMailForm();
    await fillMail(user);
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => {
      mb().click();
      mb().click();
    });
    await waitFor(() => expect(writes()).toHaveLength(1));
    act(() => mb().click());
    await new Promise((r) => setTimeout(r, 20));
    expect(writes()).toHaveLength(1);
    resolve?.();
  });

  it('Ошибка валидации с сервера', async () => {
    server.use(
      http.post('/api/listings', () =>
        apiError(400, 'VALIDATION_ERROR', 'Ошибка', [
          { path: ['toCity'], message: 'Серверная ошибка поля' },
        ]),
      ),
    );
    const { user } = await openMailForm();
    await fillMail(user);
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => mb().click());
    expect(await screen.findByText('Серверная ошибка поля')).toBeInTheDocument();
    expect(tg().HapticFeedback.notificationOccurred).toHaveBeenCalledWith('error');
  });

  it('Прочая ошибка сервера', async () => {
    server.use(
      http.post('/api/listings', () =>
        apiError(409, 'LISTING_LIMIT_REACHED', 'Можно иметь не более 5 заявок'),
      ),
    );
    const { user } = await openMailForm();
    await fillMail(user);
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => mb().click());
    await waitFor(() =>
      expect(tg().showAlert).toHaveBeenCalledWith(
        'Можно иметь не более 5 заявок',
        expect.any(Function),
      ),
    );
    expect(screen.getByLabelText('Откуда')).toHaveValue('Ашхабад');
    await waitFor(() => expect(mb().isActive).toBe(true));
    expect(mb().isProgressVisible).toBe(false);
  });

  it('Уход с формы', async () => {
    const { user } = await openMailForm();
    expect(mb().handlerCount()).toBe(1);
    act(() => tg().BackButton.click()); // → шаг выбора типа
    await screen.findByText('Что вы предлагаете?');
    act(() => tg().BackButton.click()); // → /my
    await waitFor(() => expect(screen.getByRole('navigation')).toBeInTheDocument());
    expect(mb().isVisible).toBe(false);
    expect(mb().handlerCount()).toBe(0);
    void user;
  });
});

describe('listing-form-ui: Редактирование', () => {
  it('Предзаполнение', async () => {
    const l = myMail({ fromCity: 'Ашхабад', toCity: 'Москва', departureDate: '2026-10-15' });
    server.use(http.get(`/api/listings/${l.id}`, () => HttpResponse.json(l)));
    renderApp(`/listings/${l.id}/edit`);
    expect(await screen.findByLabelText('Откуда')).toHaveValue('Ашхабад');
    expect(screen.getByLabelText('Дата вылета')).toHaveValue('2026-10-15');
    expect(screen.queryByText('Что вы предлагаете?')).not.toBeInTheDocument();
    expect(screen.getByText('Тип: Почта')).toBeInTheDocument();
    expect(mb().text).toBe('Сохранить');
  });

  it('Нет изменений', async () => {
    const l = myMail();
    server.use(http.get(`/api/listings/${l.id}`, () => HttpResponse.json(l)));
    renderApp(`/listings/${l.id}/edit`);
    await screen.findByLabelText('Откуда');
    expect(mb().isVisible).toBe(true);
    expect(mb().isActive).toBe(false);
  });

  it('Сохранение', async () => {
    const l = myTransfer({ toCity: 'Стамбул' });
    server.use(
      http.get(`/api/listings/${l.id}`, () => HttpResponse.json(l)),
      http.patch(`/api/listings/${l.id}`, () => HttpResponse.json({ ...l, toCity: 'Анкара' })),
    );
    const { user } = renderApp(`/listings/${l.id}/edit`);
    const to = await screen.findByLabelText('Город, где получат деньги');
    await user.clear(to);
    await user.type(to, 'Анкара');
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => mb().click());
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]?.method).toBe('PATCH');
    expect(writes()[0]?.body).toEqual({ toCity: 'Анкара' });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Мои заявки/ })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  });

  it('Заявка не найдена', async () => {
    server.use(
      http.get('/api/listings/:id', () => apiError(404, 'NOT_FOUND', 'Заявка не найдена')),
    );
    const { user } = renderApp(`/listings/${mailListing().id}/edit`);
    expect(await screen.findByText('Заявка не найдена')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'К моим заявкам' }));
    await waitFor(() => expect(screen.getByRole('navigation')).toBeInTheDocument());
  });

  it('Заявка чужая', async () => {
    const l = transferListing({ isOwn: false });
    server.use(
      http.get(`/api/listings/${l.id}`, () => HttpResponse.json({ ...l, isExpired: false })),
    );
    renderApp(`/listings/${l.id}/edit`);
    expect(await screen.findByText('Заявка не найдена')).toBeInTheDocument();
  });
});

describe('listing-form-ui: Поле «Комментарий»', () => {
  const lastField = () => {
    const fields = screen.getAllByRole('textbox');
    return fields[fields.length - 1];
  };

  it('Поле в форме: Почта', async () => {
    await openMailForm();
    const comment = screen.getByLabelText('Комментарий');
    expect(comment.tagName).toBe('TEXTAREA');
    expect(comment).toHaveAttribute('placeholder', 'Можете указать способ связи');
    expect(comment).toHaveAttribute('maxlength', '300');
    expect(lastField()).toBe(comment);
  });

  it('Поле в форме: Перевод', async () => {
    const { user } = renderApp('/listings/new');
    await user.click(await screen.findByRole('button', { name: /Перевод/ }));
    expect(lastField()).toBe(screen.getByLabelText('Комментарий'));
  });

  it('Публикация с комментарием', async () => {
    server.use(http.post('/api/listings', () => HttpResponse.json(myMail(), { status: 201 })));
    const { user } = await openMailForm();
    await fillMail(user);
    await user.type(screen.getByLabelText('Комментарий'), 'WhatsApp +99365000000');
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => mb().click());
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]?.body).toMatchObject({ comment: 'WhatsApp +99365000000' });
  });

  it('Публикация без комментария', async () => {
    server.use(http.post('/api/listings', () => HttpResponse.json(myMail(), { status: 201 })));
    const { user } = await openMailForm();
    await fillMail(user);
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => mb().click());
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]?.body).not.toHaveProperty('comment');
  });

  it('Очистка при редактировании', async () => {
    const l = myMail({ comment: 'IMO +99365000000' });
    server.use(
      http.get(`/api/listings/${l.id}`, () => HttpResponse.json(l)),
      http.patch(`/api/listings/${l.id}`, () => HttpResponse.json({ ...l, comment: null })),
    );
    const { user } = renderApp(`/listings/${l.id}/edit`);
    const comment = await screen.findByLabelText('Комментарий');
    expect(comment).toHaveValue('IMO +99365000000');
    await user.clear(comment);
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => mb().click());
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]?.body).toEqual({ comment: null });
  });
});

describe('listing-form-ui: Быстрый выбор города', () => {
  const CITIES = ['Балкан', 'Ашхабад', 'Мары', 'Лебап', 'Дашогуз', 'Казань', 'Москва'];
  const chips = (field: string) => screen.getByRole('group', { name: `Быстрый выбор: ${field}` });
  const chip = (field: string, city: string) =>
    within(chips(field)).getByRole('button', { name: city });

  it('Чипсы в форме: Почта', async () => {
    await openMailForm();
    for (const field of ['Откуда', 'Куда']) {
      const names = within(chips(field))
        .getAllByRole('button')
        .map((b) => b.textContent);
      expect(names).toEqual(CITIES);
    }
  });

  it('Чипсы в форме: Перевод', async () => {
    const { user } = renderApp('/listings/new');
    await user.click(await screen.findByRole('button', { name: /Перевод/ }));
    expect(within(chips('Город, где отдаю деньги')).getAllByRole('button')).toHaveLength(7);
    expect(within(chips('Город, где получат деньги')).getAllByRole('button')).toHaveLength(7);
  });

  it('Выбор из списка', async () => {
    const { user } = await openMailForm();
    await user.click(chip('Откуда', 'Мары'));
    expect(screen.getByLabelText('Откуда')).toHaveValue('Мары');
    expect(chip('Откуда', 'Мары')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Откуда', 'Москва')).toHaveAttribute('aria-pressed', 'false');
    expect(tg().HapticFeedback.selectionChanged).toHaveBeenCalled();
  });

  it('Свой город', async () => {
    server.use(http.post('/api/listings', () => HttpResponse.json(myMail(), { status: 201 })));
    const { user } = await openMailForm();
    await user.type(screen.getByLabelText('Откуда'), 'Стамбул');
    await user.click(chip('Куда', 'Москва'));
    fireEvent.change(screen.getByLabelText('Дата вылета'), { target: { value: '2026-10-15' } });
    for (const b of within(chips('Откуда')).getAllByRole('button')) {
      expect(b).toHaveAttribute('aria-pressed', 'false');
    }
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => mb().click());
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]?.body).toMatchObject({ fromCity: 'Стамбул', toCity: 'Москва' });
  });

  it('Отметка без учёта регистра', async () => {
    const { user } = await openMailForm();
    await user.type(screen.getByLabelText('Откуда'), ' ашхабад ');
    expect(chip('Откуда', 'Ашхабад')).toHaveAttribute('aria-pressed', 'true');
  });

  it('Город соседнего поля', async () => {
    const { user } = await openMailForm();
    await user.click(chip('Откуда', 'Ашхабад'));
    expect(chip('Куда', 'Ашхабад')).toBeDisabled();
    expect(chip('Куда', 'Москва')).toBeEnabled();
  });

  it('Выбор города при редактировании', async () => {
    const l = myMail({ fromCity: 'Ашхабад', toCity: 'Москва', departureDate: '2026-10-15' });
    server.use(
      http.get(`/api/listings/${l.id}`, () => HttpResponse.json(l)),
      http.patch(`/api/listings/${l.id}`, () => HttpResponse.json({ ...l, toCity: 'Казань' })),
    );
    const { user } = renderApp(`/listings/${l.id}/edit`);
    await screen.findByLabelText('Куда');
    expect(chip('Куда', 'Москва')).toHaveAttribute('aria-pressed', 'true');
    await user.click(chip('Куда', 'Казань'));
    await waitFor(() => expect(mb().isActive).toBe(true));
    act(() => mb().click());
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]?.method).toBe('PATCH');
    expect(writes()[0]?.body).toEqual({ toCity: 'Казань' });
  });
});

describe('listing-form-ui: Навигация назад', () => {
  it('Back на шаге выбора типа', async () => {
    renderApp('/listings/new');
    await screen.findByText('Что вы предлагаете?');
    expect(tg().BackButton.isVisible).toBe(true);
    act(() => tg().BackButton.click());
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Мои заявки/ })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
    expect(tg().BackButton.isVisible).toBe(false);
  });

  it('Back с несохранёнными изменениями', async () => {
    const l = myMail({ toCity: 'Москва' });
    mockMine([l]);
    server.use(http.get(`/api/listings/${l.id}`, () => HttpResponse.json(l)));
    const { user } = renderApp(`/listings/${l.id}/edit`);
    const to = await screen.findByLabelText('Куда');
    await user.clear(to);
    await user.type(to, 'Казань');

    tg().answerConfirm(false);
    act(() => tg().BackButton.click());
    expect(tg().showConfirm).toHaveBeenCalledWith('Отменить изменения?', expect.any(Function));
    expect(screen.getByLabelText('Куда')).toHaveValue('Казань');

    tg().answerConfirm(true);
    act(() => tg().BackButton.click());
    await waitFor(() => expect(screen.getByRole('navigation')).toBeInTheDocument());
  });
});

describe('telegram-auth: Отображение своего контакта в форме', () => {
  it('У пользователя есть username', async () => {
    await openMailForm();
    expect(screen.getByText('Ваш Telegram для связи: @alice')).toBeInTheDocument();
  });

  it('У пользователя нет username', async () => {
    installTelegram(createTelegramMock({ user: { id: 5, first_name: 'Иван' } }));
    await openMailForm();
    expect(screen.getByText('Ваш Telegram для связи: Иван')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Установите @username в настройках Telegram, чтобы с вами было проще связаться',
      ),
    ).toBeInTheDocument();
  });
});

describe('theming: отключение свайпов на форме', () => {
  it('на форме вертикальные свайпы отключены', async () => {
    await openMailForm();
    expect(tg().disableVerticalSwipes).toHaveBeenCalled();
  });
});

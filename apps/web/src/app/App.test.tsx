import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, tg } from '../../test/render';
import { apiError, http, requests, server } from '../../test/server';
import { createTelegramMock, installTelegram } from '../../test/telegramMock';

describe('telegram-auth: вне Telegram', () => {
  it('Приложение открыто вне Telegram', async () => {
    installTelegram(createTelegramMock({ initData: '' }));
    renderApp('/feed');
    expect(screen.getByText('Откройте приложение в Telegram')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(requests).toHaveLength(0);
  });

  it('скрипт Telegram не загрузился', () => {
    window.Telegram = undefined;
    renderApp('/feed');
    expect(screen.getByText('Откройте приложение в Telegram')).toBeInTheDocument();
  });
});

describe('theming: Инициализация WebApp', () => {
  it('Старт', () => {
    renderApp('/feed');
    expect(tg().ready).toHaveBeenCalledTimes(1);
    expect(tg().expand).toHaveBeenCalledTimes(1);
    expect(tg().setHeaderColor).toHaveBeenCalledWith('bg_color');
    expect(tg().setBackgroundColor).toHaveBeenCalledWith('bg_color');
  });

  it('Смена темы на лету', () => {
    renderApp('/feed');
    tg().setHeaderColor.mockClear();
    tg().emitThemeChanged();
    expect(tg().setHeaderColor).toHaveBeenCalledWith('bg_color');
    expect(tg().setBackgroundColor).toHaveBeenCalledWith('bg_color');
  });

  it('Старая версия клиента', async () => {
    const mock = createTelegramMock();
    mock.isVersionAtLeast.mockReturnValue(false);
    installTelegram(mock);
    const { user } = renderApp('/listings/new');
    await user.click(await screen.findByRole('button', { name: /Почта/ }));
    expect(mock.disableVerticalSwipes).not.toHaveBeenCalled();
  });
});

describe('telegram-auth: Просроченная initData', () => {
  it('показывает сообщение об устаревшей сессии', async () => {
    server.use(
      http.get('/api/listings', () =>
        apiError(401, 'INIT_DATA_EXPIRED', 'Сессия устарела, перезапустите приложение'),
      ),
    );
    renderApp('/feed');
    expect(
      await screen.findByText('Сессия устарела, перезапустите приложение'),
    ).toBeInTheDocument();
  });
});

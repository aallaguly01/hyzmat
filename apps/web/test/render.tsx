import { QueryClient } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders, AppRoutes } from '../src/app/App';
import type { TelegramMock } from './telegramMock';
import { intersectionObservers } from './io';

export function renderApp(route = '/feed') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } },
  });
  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AppProviders queryClient={queryClient}>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  );
  return { ...utils, user, queryClient };
}

export function tg(): TelegramMock {
  return window.Telegram!.WebApp as TelegramMock;
}

/** Имитирует прокрутку до конца списка. */
export function scrollToEnd() {
  act(() => intersectionObservers.forEach((o) => o.cb([{ isIntersecting: true }])));
}

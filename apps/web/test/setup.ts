import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { installIntersectionObserver, intersectionObservers } from './io';
import { requests, server } from './server';
import { installTelegram } from './telegramMock';

installIntersectionObserver();

// Относительные URL для fetch в node
const origin = 'http://localhost';
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
  realFetch(typeof input === 'string' && input.startsWith('/') ? origin + input : input, init),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  requests.length = 0;
  installTelegram();
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  intersectionObservers.length = 0;
});
afterAll(() => server.close());

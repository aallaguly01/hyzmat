import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/** Лог всех запросов к API в текущем тесте: `GET /api/listings?type=MAIL`. */
export const requests: { method: string; url: URL; body: unknown; headers: Headers }[] = [];

export const server = setupServer(
  http.get('/api/listings', () => HttpResponse.json({ items: [], nextCursor: null })),
  http.get('/api/me/listings', () => HttpResponse.json({ items: [] })),
);

server.events.on('request:start', async ({ request }) => {
  const clone = request.clone();
  let body: unknown;
  try {
    body = await clone.json();
  } catch {
    body = undefined;
  }
  requests.push({
    method: request.method,
    url: new URL(request.url),
    body,
    headers: request.headers,
  });
});

export const apiError = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });

export { http, HttpResponse };

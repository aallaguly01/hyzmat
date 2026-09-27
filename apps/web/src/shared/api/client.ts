import type { ApiErrorBody, ApiErrorIssue } from '@hyzmat/shared';
import { getWebApp } from '../telegram/webapp';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ApiErrorIssue[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    authorization: `tma ${getWebApp()?.initData ?? ''}`,
  };
  if (init.body !== undefined) headers['content-type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Нет связи с сервером. Проверьте интернет');
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error?.code ?? 'INTERNAL_ERROR',
      json?.error?.message ?? 'Что-то пошло не так. Попробуйте позже',
      json?.error?.details,
    );
  }
  return json as T;
}

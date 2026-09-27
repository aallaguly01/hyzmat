import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // staleTime 60 с: при возврате в приложение позже минуты данные перезапрашиваются в фоне
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
}

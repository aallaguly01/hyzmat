import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  ListingPageDto,
  ListingType,
  MyListingDto,
  MyListingsDto,
  SubscriptionDto,
  SubscriptionsDto,
} from '@hyzmat/shared';
import { api, ApiError } from './client';

export const keys = {
  feed: (type: ListingType, city: string) => ['feed', type, city] as const,
  feedAll: ['feed'] as const,
  mine: ['my-listings'] as const,
  listing: (id: string) => ['listing', id] as const,
  subscriptions: ['subscriptions'] as const,
};

export function useFeed(type: ListingType, city: string) {
  return useInfiniteQuery({
    queryKey: keys.feed(type, city),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ type });
      if (city) params.set('city', city);
      if (pageParam) params.set('cursor', pageParam);
      return api<ListingPageDto>(`/listings?${params}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useMyListings() {
  return useQuery({ queryKey: keys.mine, queryFn: () => api<MyListingsDto>('/me/listings') });
}

export function useListing(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.listing(id),
    queryFn: () => api<MyListingDto>(`/listings/${id}`),
    initialData: () => qc.getQueryData<MyListingsDto>(keys.mine)?.items.find((l) => l.id === id),
    initialDataUpdatedAt: () => qc.getQueryState(keys.mine)?.dataUpdatedAt,
  });
}

function upsertMine(qc: QueryClient, listing: MyListingDto, prepend: boolean) {
  qc.setQueryData<MyListingsDto>(keys.mine, (old) => {
    if (!old) return old;
    const rest = old.items.filter((l) => l.id !== listing.id);
    if (prepend) return { items: [listing, ...rest] };
    return { items: old.items.map((l) => (l.id === listing.id ? listing : l)) };
  });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<MyListingDto>('/listings', { method: 'POST', body }),
    onSuccess: (created) => {
      upsertMine(qc, { ...created, isExpired: false }, true);
      void qc.invalidateQueries({ queryKey: keys.mine });
      void qc.invalidateQueries({ queryKey: keys.feedAll });
    },
  });
}

export function useUpdateListing(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<MyListingDto>(`/listings/${id}`, { method: 'PATCH', body }),
    onSuccess: (updated) => {
      qc.setQueryData(keys.listing(id), updated);
      upsertMine(qc, updated, false);
      void qc.invalidateQueries({ queryKey: keys.mine });
      void qc.invalidateQueries({ queryKey: keys.feedAll });
    },
  });
}

/** Оптимистичное удаление: карточка пропадает сразу, при ошибке возвращается. 404 = уже удалена. */
export function useDeleteListing(opts: { onSuccess: () => void; onError: (e: Error) => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await api<void>(`/listings/${id}`, { method: 'DELETE' });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return;
        throw e;
      }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.mine });
      const prev = qc.getQueryData<MyListingsDto>(keys.mine);
      qc.setQueryData<MyListingsDto>(keys.mine, (old) =>
        old ? { items: old.items.filter((l) => l.id !== id) } : old,
      );
      return { prev };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.mine, ctx.prev);
      opts.onError(e);
    },
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: keys.listing(id) });
      opts.onSuccess();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.feedAll }),
  });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: keys.subscriptions,
    queryFn: () => api<SubscriptionsDto>('/subscriptions'),
  });
}

export function useSubscribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { type: ListingType; city: string }) =>
      api<SubscriptionDto>('/subscriptions', { method: 'POST', body }),
    onSuccess: (sub) => {
      qc.setQueryData<SubscriptionsDto>(keys.subscriptions, (old) =>
        old && !old.items.some((s) => s.id === sub.id) ? { items: [...old.items, sub] } : old,
      );
      void qc.invalidateQueries({ queryKey: keys.subscriptions });
    },
  });
}

/** Оптимистично: подписка пропадает сразу, при ошибке возвращается. 404 = уже удалена. */
export function useUnsubscribe(opts: { onError: (e: Error) => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await api<void>(`/subscriptions/${id}`, { method: 'DELETE' });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return;
        throw e;
      }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.subscriptions });
      const prev = qc.getQueryData<SubscriptionsDto>(keys.subscriptions);
      qc.setQueryData<SubscriptionsDto>(keys.subscriptions, (old) =>
        old ? { items: old.items.filter((s) => s.id !== id) } : old,
      );
      return { prev };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.subscriptions, ctx.prev);
      opts.onError(e);
    },
  });
}

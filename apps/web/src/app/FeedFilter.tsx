import type { ListingType } from '@hyzmat/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface FeedFilter {
  type: ListingType;
  setType: (t: ListingType) => void;
  city: string;
  setCity: (c: string) => void;
}

const Ctx = createContext<FeedFilter | null>(null);

/** Фильтр ленты живёт выше роутов, чтобы переживать переключение вкладок. */
export function FeedFilterProvider({ children }: { children: ReactNode }) {
  const [type, setType] = useState<ListingType>('MAIL');
  const [city, setCity] = useState('');
  const value = useMemo(() => ({ type, setType, city, setCity }), [type, city]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- хук рядом со своим провайдером
export function useFeedFilter(): FeedFilter {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFeedFilter вне FeedFilterProvider');
  return v;
}

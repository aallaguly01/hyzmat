import { parseStartParam, type MyListingDto } from '@hyzmat/shared';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api/client';
import { getWebApp } from '../shared/telegram/webapp';
import { useFeedFilter } from './FeedFilter';

// start_param относится к запуску Mini App — применяем один раз на экземпляр WebApp
const consumed = new WeakSet<object>();

/**
 * Ссылка t.me/<бот>?startapp=…: l-<id> → лента нужного типа с подсветкой заявки
 * (удалённая или истёкшая — просто лента), f-<TYPE>[-город] → лента с фильтром.
 */
export function useStartParam() {
  const navigate = useNavigate();
  const { setType, setCity, setHighlight } = useFeedFilter();

  useEffect(() => {
    const wa = getWebApp();
    if (!wa || consumed.has(wa)) return;
    consumed.add(wa);
    const param = parseStartParam(wa.initDataUnsafe.start_param);
    if (!param) return;
    navigate('/feed');
    if (param.kind === 'feed') {
      setType(param.type);
      setCity(param.city ?? '');
      return;
    }
    // тип заявки из ссылки неизвестен — узнаём его, чтобы открыть нужную ленту
    api<MyListingDto>(`/listings/${param.id}`)
      .then((listing) => {
        if (listing.isExpired) return;
        setType(listing.type);
        setCity('');
        setHighlight(listing.id);
      })
      .catch(() => {});
  }, [navigate, setType, setCity, setHighlight]);
}

import { parseStartParam } from '@hyzmat/shared';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWebApp } from '../shared/telegram/webapp';
import { useFeedFilter } from './FeedFilter';

// start_param относится к запуску Mini App — применяем один раз на экземпляр WebApp
const consumed = new WeakSet<object>();

/** Ссылка t.me/<бот>?startapp=…: l-<id> → страница заявки, f-<TYPE>[-город] → лента с фильтром. */
export function useStartParam() {
  const navigate = useNavigate();
  const { setType, setCity } = useFeedFilter();

  useEffect(() => {
    const wa = getWebApp();
    if (!wa || consumed.has(wa)) return;
    consumed.add(wa);
    const param = parseStartParam(wa.initDataUnsafe.start_param);
    if (!param) return;
    if (param.kind === 'listing') {
      navigate(`/listings/${param.id}`);
    } else {
      setType(param.type);
      setCity(param.city ?? '');
      navigate('/feed');
    }
  }, [navigate, setType, setCity]);
}

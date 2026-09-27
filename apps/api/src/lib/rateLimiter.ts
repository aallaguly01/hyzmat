/**
 * In-memory лимитер со скользящим окном. Для MVP достаточно одного инстанса API;
 * при масштабировании заменить на Redis.
 */
export function createRateLimiter(opts: { max: number; windowMs: number; now: () => number }) {
  const hits = new Map<string, number[]>();

  const recent = (key: string) => {
    const since = opts.now() - opts.windowMs;
    const list = (hits.get(key) ?? []).filter((t) => t > since);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };

  return {
    isLimited: (key: string) => recent(key).length >= opts.max,
    record: (key: string) => {
      hits.set(key, [...recent(key), opts.now()]);
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

import { createHmac } from 'node:crypto';

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

/** Строит initData, подписанную так же, как это делает Telegram. */
export function signInitData(opts: {
  botToken: string;
  user?: TgUser | string;
  authDate: number;
  extra?: Record<string, string>;
}): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(opts.authDate));
  params.set('query_id', 'AAH-test');
  if (opts.user !== undefined) {
    params.set('user', typeof opts.user === 'string' ? opts.user : JSON.stringify(opts.user));
  }
  for (const [k, v] of Object.entries(opts.extra ?? {})) params.set(k, v);

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(opts.botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

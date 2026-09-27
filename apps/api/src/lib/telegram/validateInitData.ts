import { createHmac, timingSafeEqual } from 'node:crypto';
import type { UserDto } from '@hyzmat/shared';
import { unauthorized } from '../errors';

export interface ValidateOptions {
  botToken: string;
  ttlSeconds: number;
  nowSeconds: number;
}

const invalid = () => unauthorized('INVALID_INIT_DATA', 'Не удалось проверить данные Telegram');

/**
 * Проверяет подпись initData по алгоритму Telegram:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(raw: string, opts: ValidateOptions): UserDto {
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) throw invalid();
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(opts.botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw invalid();

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || opts.nowSeconds - authDate > opts.ttlSeconds) {
    throw unauthorized('INIT_DATA_EXPIRED', 'Сессия устарела, перезапустите приложение');
  }

  const rawUser = params.get('user');
  if (!rawUser) throw invalid();
  let user: { id?: unknown; username?: unknown; first_name?: unknown; last_name?: unknown };
  try {
    user = JSON.parse(rawUser);
  } catch {
    throw invalid();
  }
  if (typeof user?.id !== 'number' || typeof user.first_name !== 'string') throw invalid();

  return {
    id: String(user.id),
    username: typeof user.username === 'string' && user.username ? user.username : null,
    firstName: user.first_name,
    lastName: typeof user.last_name === 'string' && user.last_name ? user.last_name : null,
  };
}

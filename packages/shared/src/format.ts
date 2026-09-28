const NBSP = ' ';

/** «1500.00» → «$1 500», «99.50» → «$99.50». Разделитель разрядов — неразрывный пробел. */
export function formatAmount(amount: string): string {
  const [intPart = '0', frac = '00'] = amount.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return /^0*$/.test(frac) ? `$${grouped}` : `$${grouped}.${frac.padEnd(2, '0')}`;
}

/**
 * Счётчик просмотров в стиле Telegram: «999», «1.2K», «15.3K», «150K», «1.5M».
 * Округление вниз, чтобы 999 999 не превращалось в «1000K».
 */
export function formatViews(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 100_000) return `${Math.floor(n / 100) / 10}K`;
  if (n < 1_000_000) return `${Math.floor(n / 1_000)}K`;
  return `${Math.floor(n / 100_000) / 10}M`;
}

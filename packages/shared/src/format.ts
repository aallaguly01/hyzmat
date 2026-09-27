const NBSP = ' ';

/** «1500.00» → «$1 500», «99.50» → «$99.50». Разделитель разрядов — неразрывный пробел. */
export function formatAmount(amount: string): string {
  const [intPart = '0', frac = '00'] = amount.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return /^0*$/.test(frac) ? `$${grouped}` : `$${grouped}.${frac.padEnd(2, '0')}`;
}

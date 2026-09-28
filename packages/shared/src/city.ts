/** Нормализованная форма города для поиска: без лишних пробелов, нижний регистр, ё → е. */
export function normalizeCity(city: string): string {
  return city.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е');
}

/** Латинские написания популярных городов (для команд бота вида «/pochta balkan»). */
export const CITY_ALIASES: Readonly<Record<string, string>> = {
  balkan: 'Балкан',
  ashgabat: 'Ашхабад',
  ashkhabad: 'Ашхабад',
  ashabad: 'Ашхабад',
  asgabat: 'Ашхабад',
  aşgabat: 'Ашхабад',
  mary: 'Мары',
  mari: 'Мары',
  lebap: 'Лебап',
  dashoguz: 'Дашогуз',
  dasoguz: 'Дашогуз',
  daşoguz: 'Дашогуз',
  dashkhovuz: 'Дашогуз',
  kazan: 'Казань',
  moskva: 'Москва',
  moscow: 'Москва',
};

/** «balkan» → «Балкан»; незнакомое название возвращается как есть (без крайних пробелов). */
export function resolveCityAlias(city: string): string {
  const trimmed = city.trim();
  return CITY_ALIASES[trimmed.replace(/\s+/g, ' ').toLowerCase()] ?? trimmed;
}

/** Нормализованная форма города для поиска: без лишних пробелов, нижний регистр, ё → е. */
export function normalizeCity(city: string): string {
  return city.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е');
}

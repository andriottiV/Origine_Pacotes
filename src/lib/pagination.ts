export const CLIENT_PAGE_SIZE = 50;
export const USAGE_PAGE_SIZE = 20;
export function pageNumber(value?: string) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, 5000) : 0;
}
export function pageHref(path: string, params: Record<string, string | undefined>, key: string, page: number) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) if (value) query.set(name, value);
  if (page > 0) query.set(key, String(page)); else query.delete(key);
  return path + (query.size ? '?' + query.toString() : '');
}
// Keep PostgREST filter operators out of user-provided substring searches.
export function searchTerm(value = '') { return value.trim().replace(/[,()%_*\\"]/g, ' ').slice(0, 100).trim(); }

type QueryValue = string | number | boolean;
type SearchLike = { toString(): string };

export function buildHrefWithSearch(
  pathname: string,
  currentSearchParams?: SearchLike,
  extraParams?: Record<string, QueryValue | null | undefined>
) {
  const nextSearchParams = new URLSearchParams(currentSearchParams?.toString() ?? '');

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        nextSearchParams.delete(key);
        return;
      }

      nextSearchParams.set(key, String(value));
    });
  }

  const queryString = nextSearchParams.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}

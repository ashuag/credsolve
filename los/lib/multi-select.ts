/** Comma-separated multi-select filter helpers for LOS table columns. */

export function parseMultiSelect(raw: string | null | undefined): string[] {
  const value = raw?.trim() ?? '';
  if (!value) return [];
  return [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))];
}

export function serializeMultiSelect(values: string[]): string {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].join(',');
}

export function matchesMultiSelect(
  actual: string | number | null | undefined,
  filterValue: string,
): boolean {
  const selected = parseMultiSelect(filterValue);
  if (selected.length === 0) return true;
  const haystack = String(actual ?? '').toLowerCase();
  return selected.some((value) => value.toLowerCase() === haystack);
}

export function formatMultiSelectLabel(
  values: string[],
  options?: Array<{ value: string; label: string }>,
  emptyLabel = 'All',
): string {
  if (values.length === 0) return emptyLabel;
  const labels = values.map(
    (value) => options?.find((option) => option.value === value)?.label ?? value,
  );
  if (labels.length <= 3) return labels.join(', ');
  return `${labels.length} selected`;
}

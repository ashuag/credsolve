/** Inclusive numeric min/max filters for LOS table columns (e.g. CIBIL score). */

export type NumberRangeValue = {
  min: number | null;
  max: number | null;
};

export type NumberRangePreset = {
  label: string;
  min?: number;
  max?: number;
};

export function serializeNumberRange(value: NumberRangeValue): string {
  if (value.min == null && value.max == null) return '';
  return `${value.min ?? ''}|${value.max ?? ''}`;
}

export function parseNumberRange(raw: string | null | undefined): NumberRangeValue | null {
  const value = raw?.trim() ?? '';
  if (!value) return null;
  const match = /^(-?\d+(?:\.\d+)?)?\|(-?\d+(?:\.\d+)?)?$/.exec(value);
  if (!match) return null;
  const min = match[1] ? Number(match[1]) : null;
  const max = match[2] ? Number(match[2]) : null;
  if (min == null && max == null) return null;
  if (min != null && !Number.isFinite(min)) return null;
  if (max != null && !Number.isFinite(max)) return null;
  return { min, max };
}

export function normalizeNumberRange(value: NumberRangeValue): NumberRangeValue {
  if (value.min != null && value.max != null && value.min > value.max) {
    return { min: value.max, max: value.min };
  }
  return value;
}

export function matchesNumberRange(
  actual: string | number | null | undefined,
  filterValue: string,
): boolean {
  const range = parseNumberRange(filterValue);
  if (!range) return true;
  if (actual == null || actual === '') return false;
  const n = typeof actual === 'number' ? actual : Number(actual);
  if (!Number.isFinite(n)) return false;
  const { min, max } = normalizeNumberRange(range);
  if (min != null && n < min) return false;
  if (max != null && n > max) return false;
  return true;
}

export function matchingNumberRangePreset(
  value: NumberRangeValue,
  presets: NumberRangePreset[] | undefined,
): string | null {
  if (!presets?.length) return null;
  const normalized = normalizeNumberRange(value);
  for (const preset of presets) {
    const presetMin = preset.min ?? null;
    const presetMax = preset.max ?? null;
    if (presetMin === normalized.min && presetMax === normalized.max) return preset.label;
  }
  return null;
}

export function formatNumberRangeLabel(
  value: NumberRangeValue,
  presets?: NumberRangePreset[],
): string {
  const preset = matchingNumberRangePreset(value, presets);
  if (preset) return preset;
  const { min, max } = normalizeNumberRange(value);
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `≥ ${min}`;
  if (max != null) return `≤ ${max}`;
  return '';
}

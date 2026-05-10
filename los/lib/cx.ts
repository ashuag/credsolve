/**
 * Joins truthy class-name fragments with spaces.
 * Falsy values (`false`, `null`, `undefined`, `''`) are dropped, so
 * `cx('a', cond && 'b')` is the canonical conditional class pattern.
 */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

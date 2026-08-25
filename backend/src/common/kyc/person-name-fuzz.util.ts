import { normalizePersonNameForMatch } from './aadhaar-lead-identity-match.util';

/** Leading honorifics banks often prefix on account-holder names (longest first so Miss ≠ Ms). */
const HONORIFIC_PREFIX = /^(?:miss|mrs|ms|mr)\b\.?\s*/i;

/**
 * Strip titles such as Mr / Ms / Miss / Mrs (with or without ".") and collapse extra spaces
 * so penny-drop names can be compared to the customer journey name.
 */
export function stripPersonNameHonorifics(raw: string): string {
  let name = raw.trim().replace(/\s+/g, ' ');
  for (;;) {
    const next = name.replace(HONORIFIC_PREFIX, '').trim();
    if (next === name) break;
    name = next;
  }
  return name.replace(/\s+/g, ' ');
}

function tokens(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / maxLen;
}

/** Exact match, initial (S vs SAURABH), or edit-distance similarity. */
function tokenSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (left.length === 1 && right.startsWith(left)) return 0.85;
  if (right.length === 1 && left.startsWith(right)) return 0.85;
  return similarity(left, right);
}

function averageBestTokenCoverage(from: string[], into: string[]): number {
  if (from.length === 0) return 0;
  let sum = 0;
  for (const token of from) {
    let best = 0;
    for (const other of into) {
      best = Math.max(best, tokenSimilarity(token, other));
    }
    sum += best;
  }
  return sum / from.length;
}

/**
 * 0–100 fuzzing score between two person names (honorifics stripped, token order ignored).
 * Token-sorted exact match is 100.
 */
export function computePersonNameFuzzScore(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const a = normalizePersonNameForMatch(stripPersonNameHonorifics(left ?? ''));
  const b = normalizePersonNameForMatch(stripPersonNameHonorifics(right ?? ''));
  if (!a || !b) return 0;
  if (a === b) return 100;

  const tokensA = tokens(a);
  const tokensB = tokens(b);
  if (tokensA.slice().sort().join(' ') === tokensB.slice().sort().join(' ')) return 100;

  const coverage =
    (averageBestTokenCoverage(tokensA, tokensB) + averageBestTokenCoverage(tokensB, tokensA)) / 2;
  const sequence = similarity(tokensA.slice().sort().join(' '), tokensB.slice().sort().join(' '));
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  return Math.max(0, Math.min(100, Math.round(100 * (0.5 * coverage + 0.3 * sequence + 0.2 * jaccard))));
}

/**
 * Aadhaar / DigiLocker and IFSC vendor records store addresses in ALL CAPS. Title-case them
 * for display only; the stored value is never rewritten.
 */

/** Acronyms and codes that must stay uppercase. */
const UPPERCASE_WORDS = new Set([
  // Address abbreviations
  'NH',
  'SH',
  'PO',
  'PS',
  'VPO',
  'RS',
  'GPO',
  'MIDC',
  'DLF',
  'HAL',
  'LIG',
  'MIG',
  'HIG',
  'ATM',
  'IFSC',
  'MICR',
  // Bank acronyms, so "HDFC BANK" does not become "Hdfc Bank"
  'HDFC',
  'ICICI',
  'SBI',
  'IDBI',
  'IDFC',
  'RBL',
  'UCO',
  'PNB',
  'BOB',
  'BOI',
  'IOB',
  'KVB',
  'TMB',
  'DCB',
  'IDCB',
]);

/** Joining words that read better lowercase, e.g. "State Bank of India". */
const LOWERCASE_WORDS = new Set(['OF', 'AND', 'THE', 'AT', 'IN', 'ON', 'TO', 'BY', 'FOR']);

/** Short tokens that are real words, not initials, so they must not stay uppercase. */
const TITLE_CASE_WORDS = new Set(['NO', 'ST', 'RD', 'DR', 'MR', 'MS', 'KM', 'NR']);

/** Ordinal suffixes, lowercased when glued to a number: "3RD" -> "3rd". */
const ORDINAL_SUFFIXES = new Set(['ST', 'ND', 'RD', 'TH']);

function titleCase(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function formatToken(token: string, isFirst: boolean, followsDigit: boolean): string {
  const letters = token.replace(/[^A-Za-z]/g, '');
  if (!letters) return token;
  const key = letters.toUpperCase();

  if (UPPERCASE_WORDS.has(key)) return token.toUpperCase();
  // "3RD CROSS" -> "3rd Cross", while a door number such as "12B" keeps its suffix uppercase.
  if (followsDigit && ORDINAL_SUFFIXES.has(key)) return token.toLowerCase();
  if (LOWERCASE_WORDS.has(key) && !isFirst) return token.toLowerCase();
  if (TITLE_CASE_WORDS.has(key)) return titleCase(token);
  // An internal dot marks an abbreviation such as "H.NO".
  if (/[A-Za-z]\.[A-Za-z]/.test(token)) return token.toUpperCase();
  // Remaining one and two letter tokens are initials: "S/O RAM", "MG ROAD".
  if (letters.length <= 2) return token.toUpperCase();

  return titleCase(token);
}

/**
 * Title-case an ALL-CAPS address or branch name for readability. Values that already contain
 * lowercase letters are returned unchanged, so hand-entered text is never re-cased. Door
 * numbers and PIN codes are untouched because only letter runs are rewritten.
 */
export function formatAddressForDisplay(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/[a-z]/.test(trimmed)) return trimmed;

  return trimmed.replace(/[A-Za-z][A-Za-z.]*/g, (token, offset: number) =>
    formatToken(token, offset === 0, offset > 0 && /\d/.test(trimmed.charAt(offset - 1))),
  );
}

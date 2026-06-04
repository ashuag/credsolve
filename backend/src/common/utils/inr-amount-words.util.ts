const BELOW_TWENTY = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
] as const;

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'] as const;

function twoDigits(n: number): string {
  if (n < 20) return BELOW_TWENTY[n] ?? '';
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? (TENS[t] ?? '') : `${TENS[t] ?? ''} ${BELOW_TWENTY[u] ?? ''}`.trim();
}

function threeDigits(n: number): string {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${BELOW_TWENTY[h]} Hundred`);
  if (rest > 0) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/** Indian numbering: Rupees X Only (lakhs / crores). */
export function inrAmountToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '';
  const rounded = Math.round(amount);
  if (rounded === 0) return 'Zero Rupees Only';

  const parts: string[] = [];
  let n = rounded;

  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore > 0) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${threeDigits(thousand)} Thousand`);
  if (n > 0) parts.push(threeDigits(n));

  return `${parts.join(' ').trim()} Rupees Only`;
}

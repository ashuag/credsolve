/**
 * Standard PDF fonts (Helvetica, etc.) use WinAnsi encoding and cannot render ₹ or most Unicode.
 * Use on every string passed to pdf-lib `drawText` / `widthOfTextAtSize`.
 */
export function pdfSafeText(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/\u20b9/g, 'Rs. ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ');

  let out = '';
  for (const ch of normalized) {
    const code = ch.charCodeAt(0);
    if (code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      out += ch;
    }
  }
  return out;
}

/** INR amounts for PDF tables (never uses the rupee sign). */
export function formatInrAmountForPdf(raw: unknown): string {
  if (raw == null) return '-';
  const s = String(raw).trim();
  if (!s || s === '-1' || s === '-1.00') return '-';
  const n = Number.parseInt(s.replace(/,/g, ''), 10);
  if (!Number.isFinite(n)) return pdfSafeText(s);
  return `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

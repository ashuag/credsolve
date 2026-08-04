import { istCalendarDateUtc } from './loan-calculation.util';

export type BounceChargeTierRow = {
  minAmountInr: number;
  maxAmountInr: number | null;
  bounceFeeInr: { toNumber(): number } | number | string;
  sortOrder?: number;
  isActive?: boolean;
};

function feeToNumber(value: BounceChargeTierRow['bounceFeeInr']): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseFloat(value);
  return value.toNumber();
}

/** Format amount band for sanction letter / KFS (e.g. `0 – 2,000`, `10,001 and above`). */
export function formatBounceAmountBand(minAmountInr: number, maxAmountInr: number | null): string {
  const fmt = (n: number) => n.toLocaleString('en-IN');
  if (maxAmountInr == null) {
    return `${fmt(minAmountInr)} and above`;
  }
  return `${fmt(minAmountInr)} – ${fmt(maxAmountInr)}`;
}

/**
 * Resolve bounce fee for an amount from active tiers.
 * Band is inclusive on both ends when max is set; open upper bound when max is null.
 */
export function resolveBounceFeeInr(
  amountInr: number,
  tiers: BounceChargeTierRow[],
): number {
  if (!(amountInr >= 0) || !Number.isFinite(amountInr)) return 0;
  const active = tiers
    .filter((t) => t.isActive !== false)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  for (const tier of active) {
    const min = tier.minAmountInr;
    const max = tier.maxAmountInr;
    if (amountInr < min) continue;
    if (max == null || amountInr <= max) {
      const fee = feeToNumber(tier.bounceFeeInr);
      return Number.isFinite(fee) ? Math.round(fee * 100) / 100 : 0;
    }
  }
  return 0;
}

/** True when IST calendar day is after the loan maturity date (due day itself is still on time). */
export function isRepaymentPastDue(
  loanMaturityDate: Date,
  asOf: Date = new Date(),
): boolean {
  const today = istCalendarDateUtc(asOf);
  const maturity = Date.UTC(
    loanMaturityDate.getUTCFullYear(),
    loanMaturityDate.getUTCMonth(),
    loanMaturityDate.getUTCDate(),
  );
  return today.getTime() > maturity;
}

/** HTML table body rows for bounce schedule (escaped). */
export function renderBounceChargeTierHtmlRows(tiers: BounceChargeTierRow[]): string {
  const active = tiers
    .filter((t) => t.isActive !== false)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return active
    .map((tier) => {
      const band = formatBounceAmountBand(tier.minAmountInr, tier.maxAmountInr);
      const fee = feeToNumber(tier.bounceFeeInr);
      const feeLabel = Number.isFinite(fee)
        ? `₹${fee.toLocaleString('en-IN')}/-`
        : '—';
      return `<tr><td class="center">${escapeHtml(band)}</td><td class="center">${escapeHtml(feeLabel)}</td></tr>`;
    })
    .join('\n      ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

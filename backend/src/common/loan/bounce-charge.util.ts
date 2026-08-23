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
 * Penal charge on overdue principal: `PENAL_RATE_PERCENT` of outstanding, then clamped between
 * `PENAL_MIN_INR` and `PENAL_MAX_INR`. Operators tune these through the `setting` table; these
 * values are only the fallback used when the table cannot be read.
 */
export type PenalChargeConfig = {
  ratePercent: number;
  minInr: number;
  maxInr: number;
};

export const DEFAULT_PENAL_CHARGE_CONFIG: PenalChargeConfig = {
  ratePercent: 10,
  minInr: 100,
  maxInr: 3_000,
};

function resolvePenalConfig(penal: PenalChargeConfig = DEFAULT_PENAL_CHARGE_CONFIG): PenalChargeConfig {
  const ratePercent =
    Number.isFinite(penal.ratePercent) && penal.ratePercent >= 0
      ? penal.ratePercent
      : DEFAULT_PENAL_CHARGE_CONFIG.ratePercent;
  const minInr =
    Number.isFinite(penal.minInr) && penal.minInr >= 0
      ? penal.minInr
      : DEFAULT_PENAL_CHARGE_CONFIG.minInr;
  const maxInr =
    Number.isFinite(penal.maxInr) && penal.maxInr > 0
      ? penal.maxInr
      : DEFAULT_PENAL_CHARGE_CONFIG.maxInr;
  return { ratePercent, minInr, maxInr };
}

/**
 * Penal charge when repayment is overdue: `ratePercent` of principal, then min/max caps.
 * Zero while the loan is still within term. Not multiplied by overdue days.
 */
export function computePenalChargeInr(
  amountInr: number,
  overdueDays: number,
  penal: PenalChargeConfig = DEFAULT_PENAL_CHARGE_CONFIG,
): number {
  if (!Number.isFinite(overdueDays) || overdueDays <= 0) return 0;
  if (!(amountInr >= 0) || !Number.isFinite(amountInr)) return 0;
  const { ratePercent, minInr, maxInr } = resolvePenalConfig(penal);
  const raw = Math.round(((amountInr * ratePercent) / 100) * 100) / 100;
  return Math.round(Math.min(Math.max(raw, minInr), maxInr) * 100) / 100;
}

/** Display strings for penal parameters on the sanction letter / KFS (e.g. `10%`, `3,000`). */
export function formatPenalChargeDisplay(config: PenalChargeConfig): {
  ratePercent: string;
  minInr: string;
  maxInr: string;
} {
  const amount = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return {
    ratePercent: `${Number(config.ratePercent.toFixed(2))}%`,
    minInr: amount(config.minInr),
    maxInr: amount(config.maxInr),
  };
}

/**
 * Resolve the per-day bounce rate for an amount from active tiers.
 * Band is inclusive on both ends when max is set; open upper bound when max is null.
 */
export function resolveBounceRatePerDayInr(
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

/**
 * Signed IST calendar days until maturity: positive before the due day, 0 on it, negative once
 * past due. IST matters because a UTC-clocked server rolls the day over 5.5 hours late.
 */
export function daysToMaturityIst(loanMaturityDate: Date, asOf: Date = new Date()): number {
  const today = istCalendarDateUtc(asOf);
  const maturity = Date.UTC(
    loanMaturityDate.getUTCFullYear(),
    loanMaturityDate.getUTCMonth(),
    loanMaturityDate.getUTCDate(),
  );
  return Math.round((maturity - today.getTime()) / 86_400_000);
}

/** IST calendar days past maturity; 0 on or before the due day (due day itself is on time). */
export function overdueDaysFromMaturity(
  loanMaturityDate: Date,
  asOf: Date = new Date(),
): number {
  const days = -daysToMaturityIst(loanMaturityDate, asOf);
  return days > 0 ? days : 0;
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

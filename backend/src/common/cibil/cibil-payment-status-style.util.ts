import { rgb, type RGB } from 'pdf-lib';
import { parsePayStatusToDpdDays } from './cibil-bureau-rules.parser';

export type PaymentStatusCategory =
  | 'empty'
  | 'current'
  | 'not_reported'
  | 'sma'
  | 'pwos'
  | 'dpd_1_29'
  | 'dpd_30_59'
  | 'dpd_60_89'
  | 'dpd_90plus'
  | 'substandard'
  | 'doubtful'
  | 'loss'
  | 'settled'
  | 'written_off'
  | 'unknown';

export type PaymentStatusVisual = {
  category: PaymentStatusCategory;
  bg: RGB | null;
  fg: RGB;
  legendLabel: string;
};

const FG_DARK = rgb(0.12, 0.14, 0.16);
const FG_WHITE = rgb(1, 1, 1);
const FG_MUTED = rgb(0.55, 0.57, 0.6);

const CLASSIFICATION_VISUALS: Record<
  Exclude<PaymentStatusCategory, 'empty' | 'unknown' | 'dpd_1_29' | 'dpd_30_59' | 'dpd_60_89' | 'dpd_90plus'>,
  PaymentStatusVisual
> = {
  current: {
    category: 'current',
    bg: rgb(0.9, 0.96, 0.9),
    fg: rgb(0.1, 0.48, 0.22),
    legendLabel: 'STD / 0 — Current',
  },
  not_reported: {
    category: 'not_reported',
    bg: null,
    fg: FG_MUTED,
    legendLabel: 'XXX — Not reported',
  },
  sma: {
    category: 'sma',
    bg: rgb(1, 0.93, 0.65),
    fg: rgb(0.55, 0.35, 0.02),
    legendLabel: 'SMA — Special mention',
  },
  pwos: {
    category: 'pwos',
    bg: rgb(0.95, 0.75, 0.55),
    fg: rgb(0.45, 0.18, 0.05),
    legendLabel: 'PWOS — Pre written-off',
  },
  substandard: {
    category: 'substandard',
    bg: rgb(0.98, 0.82, 0.72),
    fg: rgb(0.7, 0.22, 0.12),
    legendLabel: 'SUB — Substandard',
  },
  doubtful: {
    category: 'doubtful',
    bg: rgb(0.92, 0.45, 0.38),
    fg: FG_WHITE,
    legendLabel: 'DBT — Doubtful',
  },
  loss: {
    category: 'loss',
    bg: rgb(0.72, 0.12, 0.14),
    fg: FG_WHITE,
    legendLabel: 'LSS — Loss',
  },
  settled: {
    category: 'settled',
    bg: rgb(0.55, 0.28, 0.62),
    fg: FG_WHITE,
    legendLabel: 'SET — Settled',
  },
  written_off: {
    category: 'written_off',
    bg: rgb(0.45, 0.12, 0.12),
    fg: FG_WHITE,
    legendLabel: 'WO — Written-off',
  },
};

function dpdVisual(days: number): PaymentStatusVisual {
  if (days >= 90) {
    return {
      category: 'dpd_90plus',
      bg: rgb(0.72, 0.12, 0.14),
      fg: FG_WHITE,
      legendLabel: '90+ DPD',
    };
  }
  if (days >= 60) {
    return {
      category: 'dpd_60_89',
      bg: rgb(0.98, 0.72, 0.68),
      fg: rgb(0.62, 0.1, 0.1),
      legendLabel: '60–89 DPD',
    };
  }
  if (days >= 30) {
    return {
      category: 'dpd_30_59',
      bg: rgb(1, 0.82, 0.55),
      fg: rgb(0.62, 0.28, 0.02),
      legendLabel: '30–59 DPD',
    };
  }
  if (days >= 1) {
    return {
      category: 'dpd_1_29',
      bg: rgb(1, 0.95, 0.72),
      fg: rgb(0.52, 0.38, 0.02),
      legendLabel: '1–29 DPD',
    };
  }
  return CLASSIFICATION_VISUALS.current;
}

/** Map a bureau payment-history cell to PDF colors (aligned with BRE delinquency tiers). */
export function resolvePaymentStatusVisual(raw: string | undefined | null): PaymentStatusVisual {
  const code = String(raw ?? '').trim().toUpperCase();
  if (!code) {
    return { category: 'empty', bg: null, fg: FG_MUTED, legendLabel: '' };
  }
  if (code === 'XXX') {
    return CLASSIFICATION_VISUALS.not_reported;
  }
  if (code === 'STD' || code === '0' || code === '00' || code === '000') {
    return CLASSIFICATION_VISUALS.current;
  }
  if (code === 'SMA' || code.startsWith('SMA')) {
    return CLASSIFICATION_VISUALS.sma;
  }
  if (code === 'PWOS') {
    return CLASSIFICATION_VISUALS.pwos;
  }
  if (code === 'SUB') {
    return CLASSIFICATION_VISUALS.substandard;
  }
  if (code === 'DBT') {
    return CLASSIFICATION_VISUALS.doubtful;
  }
  if (code === 'LSS' || code === 'LOSS') {
    return CLASSIFICATION_VISUALS.loss;
  }
  if (code === 'SET' || code === 'SETTLED') {
    return CLASSIFICATION_VISUALS.settled;
  }
  if (code === 'WOF' || code === 'WOFF' || code === 'WO' || code.includes('WRITTEN')) {
    return CLASSIFICATION_VISUALS.written_off;
  }

  const dpdDays = parsePayStatusToDpdDays(raw);
  if (dpdDays != null) {
    return dpdVisual(dpdDays);
  }

  return { category: 'unknown', bg: rgb(0.94, 0.94, 0.94), fg: FG_DARK, legendLabel: code };
}

/** True when a formatted amount field indicates write-off / settlement / overdue exposure. */
export function isAdverseAmountDisplay(value: string | undefined | null): boolean {
  const s = String(value ?? '').trim();
  if (!s || s === '-' || s === '-1') return false;
  const digits = s.replace(/[^\d.]/g, '');
  if (!digits) return false;
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) && n > 0;
}

export const PAYMENT_STATUS_LEGEND: PaymentStatusVisual[] = [
  CLASSIFICATION_VISUALS.current,
  dpdVisual(15),
  dpdVisual(45),
  dpdVisual(75),
  dpdVisual(120),
  CLASSIFICATION_VISUALS.sma,
  CLASSIFICATION_VISUALS.pwos,
  CLASSIFICATION_VISUALS.substandard,
  CLASSIFICATION_VISUALS.doubtful,
  CLASSIFICATION_VISUALS.loss,
  CLASSIFICATION_VISUALS.settled,
  CLASSIFICATION_VISUALS.written_off,
  CLASSIFICATION_VISUALS.not_reported,
];

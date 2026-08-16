/**
 * CIBIL credit-assessment engine — implements the "CIBIL Credit Assessment Process"
 * guide's Category rules (§4), Credit Decision logic (§5) and Payment Probability
 * model (§6) as deterministic rules over `CibilAssessmentSignals`.
 *
 * The guide's Category_New column was originally produced by a Random Forest model
 * trained offline (Python/Excel). Without that training pipeline, category is instead
 * assigned from the guide's own primary rule — total loan count is "the single
 * strongest predictor" (~46% of predictive power) — using the exact bucket table in
 * §4. The guide's "secondary adjustment" signals (credit cards, enquiries, etc.) are
 * documented only as directional weights with no numeric thresholds, so they are not
 * applied here — inventing thresholds the guide doesn't specify would not be "logic
 * which is given".
 */
import type { CibilAssessmentSignals } from './cibil-bureau-rules.parser';

export type CibilCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

const CATEGORY_MEANING: Record<CibilCategory, string> = {
  A: 'Credit-active prime borrower — heavy credit user with long bureau history.',
  B: 'Near-prime active borrower — active borrower with wide credit footprint.',
  C: 'Mid-prime borrower — moderate credit user.',
  D: 'Below-average credit — below-average credit engagement.',
  E: 'Subprime borrower — low engagement, subprime signals.',
  F: 'High-risk borrower — thin-moderate file, high delinquency.',
  G: 'Very high-risk borrower — very thin file, severe delinquency.',
  H: 'Thin-file / NTC / Distressed — thin-file or severely distressed borrower.',
};

/** §4 primary rule — total loan count buckets, checked highest category first. */
const CATEGORY_LOAN_COUNT_BANDS: { category: CibilCategory; minLoans: number; rangeLabel: string }[] = [
  { category: 'A', minLoans: 66, rangeLabel: '> 65' },
  { category: 'B', minLoans: 44, rangeLabel: '44 – 65' },
  { category: 'C', minLoans: 35, rangeLabel: '35 – 44' },
  { category: 'D', minLoans: 28, rangeLabel: '28 – 35' },
  { category: 'E', minLoans: 22, rangeLabel: '22 – 28' },
  { category: 'F', minLoans: 17, rangeLabel: '17 – 22' },
  { category: 'G', minLoans: 11, rangeLabel: '11 – 17' },
  { category: 'H', minLoans: 0, rangeLabel: '<= 10' },
];

export function assignCibilCategory(signals: CibilAssessmentSignals): { category: CibilCategory; description: string } {
  const band = CATEGORY_LOAN_COUNT_BANDS.find((b) => signals.noOfLoans >= b.minLoans) ?? CATEGORY_LOAN_COUNT_BANDS[CATEGORY_LOAN_COUNT_BANDS.length - 1];
  const description = `Category ${band.category}: ${CATEGORY_MEANING[band.category]} no_of_loans=${signals.noOfLoans} falls in the ${band.rangeLabel} range.`;
  return { category: band.category, description };
}

export type CibilCreditDecision = {
  creditStatus: 'Approved' | 'Rejected';
  reasons: string[];
};

/** §5 — hard rejection rules (automatic, no override) + conditional rejection rules. */
export function evaluateCibilCreditDecision(
  signals: CibilAssessmentSignals,
  category: CibilCategory,
): CibilCreditDecision {
  const reasons: string[] = [];

  if (signals.hasWilfulDefault) {
    reasons.push('Wilful default on record (RBI blacklist)');
  }
  if (signals.hasActiveDbt) {
    reasons.push('Active Doubtful (DBT) account');
  }
  if (signals.hasActiveLss) {
    reasons.push('Active Loss (LSS) account');
  }
  if (signals.riskScore == null || signals.riskScore === 0) {
    reasons.push('No CIBIL score on file (NTC)');
  } else if (signals.riskScore < 600) {
    reasons.push(`CIBIL score critically low (${signals.riskScore} < 600)`);
  }
  if (signals.dpd90InLast12MonthsCount > 0) {
    reasons.push('DPD 90+ days in last 12 months');
  }

  const weakScore680 = signals.riskScore != null && signals.riskScore < 680;
  const weakScore700 = signals.riskScore != null && signals.riskScore < 700;

  if (signals.dpd60InLast9MonthsCount > 0 && weakScore680) {
    reasons.push('DPD 60+ days in last 9 months with weak CIBIL score (< 680)');
  }
  if (signals.writeoffTotalAmountInr > 50_000 && weakScore700) {
    reasons.push(`Writeoff amount ₹${signals.writeoffTotalAmountInr} exceeds ₹50,000 with weak CIBIL score (< 700)`);
  }
  if (signals.doubtfulOrLossInLast18MonthsCount > 0 && weakScore680) {
    reasons.push('Doubtful/Loss classification in last 18 months with weak CIBIL score (< 680)');
  }
  if (category === 'H' && signals.dpd60InLast9MonthsCount > 0) {
    reasons.push('Category H (thin-file) with active DPD 60+');
  }

  return { creditStatus: reasons.length === 0 ? 'Approved' : 'Rejected', reasons };
}

/** §6 — base payment probability from CIBIL score band. */
function basePaymentProbability(riskScore: number | null): number {
  if (riskScore == null || riskScore === 0) return 25;
  if (riskScore >= 800) return 93;
  if (riskScore >= 750) return 88;
  if (riskScore >= 720) return 83;
  if (riskScore >= 700) return 78;
  if (riskScore >= 675) return 72;
  if (riskScore >= 650) return 65;
  if (riskScore >= 600) return 55;
  return 40; // 1 - 599
}

/** §6 — category adjustment applied after per-tradeline deductions. */
const CATEGORY_ADJUSTMENT: Record<CibilCategory, number> = {
  A: 4,
  B: 2,
  C: 0,
  D: -2,
  E: -4,
  F: -6,
  G: -8,
  H: -10,
};

/**
 * §6 deductions. Two rows are documented as "up to -X% based on amount" without an exact
 * formula (writeoff amount, high overdue amount). Both are scaled linearly against the
 * ₹50,000 threshold the guide already uses elsewhere (§5's writeoff/overdue reject rules),
 * capped at the documented maximum — the only numeric anchor the guide provides.
 */
function computePaymentProbabilityDeductions(signals: CibilAssessmentSignals): number {
  let total = 0;

  if (signals.hasWilfulDefault) total -= 40;
  if (signals.hasSuitFiledOnly) total -= 30;
  if (signals.hasActiveDbt) total -= 20;
  if (signals.hasActiveLss) total -= 22;
  if (signals.doubtfulOrLossInLast18MonthsCount > 0) total -= 14;
  if (signals.dpd90InLast12MonthsCount > 0) total -= 18;
  if (signals.dpd60InLast9MonthsCount > 0) total -= 12;
  if (signals.defaultsInLast18MonthsCount > 0) total -= 10;
  if (signals.writeoffPresent) {
    total -= 10;
    total -= Math.min(12, (signals.writeoffTotalAmountInr / 50_000) * 12);
  }
  if (signals.pwosTradelinesCount > 0) total -= 7;
  if (signals.dpd30InLast3MonthsCount > 0) total -= 6;
  if (signals.missedPaymentsInLast6MonthsCount > 0) total -= 6;
  if (signals.openLoanDpdInLast6MonthsCount > 0) total -= 5;
  if (signals.restructuredLoansCount > 0) total -= 5;
  if (signals.settledLoansCount > 0) total -= 4;
  if (signals.hasActiveSub) total -= 8;
  if (signals.totalOverdueAmountInr > 50_000) {
    total -= Math.min(8, ((signals.totalOverdueAmountInr - 50_000) / 100_000) * 8);
  }

  return total;
}

/** §6 — final payment probability, clamped to [5, 98]. */
export function computePaymentProbabilityPct(signals: CibilAssessmentSignals, category: CibilCategory): number {
  const raw =
    basePaymentProbability(signals.riskScore) +
    computePaymentProbabilityDeductions(signals) +
    CATEGORY_ADJUSTMENT[category];
  const clamped = Math.min(98, Math.max(5, raw));
  return Math.round(clamped * 100) / 100;
}

export type CibilCreditAssessmentResult = {
  category: CibilCategory;
  categoryDescription: string;
  creditStatus: 'Approved' | 'Rejected';
  rejectionReasons: string | null;
  paymentProbabilityPct: number;
  /** Approved only if Credit_Status = Approved AND Payment_Probability_Pct >= 75. */
  creditRecommendation: 'Approved' | 'Rejected';
  recommendationRejectionReason: string | null;
};

const RECOMMENDATION_THRESHOLD_PCT = 75;

/** Runs the full §4-§6 pipeline over pre-computed bureau signals. */
export function runCibilCreditAssessment(signals: CibilAssessmentSignals): CibilCreditAssessmentResult {
  const { category, description: categoryDescription } = assignCibilCategory(signals);
  const decision = evaluateCibilCreditDecision(signals, category);
  const paymentProbabilityPct = computePaymentProbabilityPct(signals, category);

  const recommendationReasons = [...decision.reasons];
  const meetsProbabilityThreshold = paymentProbabilityPct >= RECOMMENDATION_THRESHOLD_PCT;
  if (decision.creditStatus === 'Approved' && !meetsProbabilityThreshold) {
    recommendationReasons.push(`Payment probability ${paymentProbabilityPct}% is below the ${RECOMMENDATION_THRESHOLD_PCT}% threshold`);
  }
  const creditRecommendation: 'Approved' | 'Rejected' =
    decision.creditStatus === 'Approved' && meetsProbabilityThreshold ? 'Approved' : 'Rejected';

  return {
    category,
    categoryDescription,
    creditStatus: decision.creditStatus,
    rejectionReasons: decision.reasons.length > 0 ? decision.reasons.join(' | ') : null,
    paymentProbabilityPct,
    creditRecommendation,
    recommendationRejectionReason: recommendationReasons.length > 0 ? recommendationReasons.join(' | ') : null,
  };
}

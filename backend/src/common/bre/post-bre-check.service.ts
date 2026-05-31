import { Injectable, Logger } from '@nestjs/common';
import { APPLICATION_STATUS } from '../constants/application.constants';
import { ELIGIBILITY_CRITERIA as EC } from '../constants/eligibility-criteria.constants';
import { REJECTION_REASON } from '../constants/rejection-reason.constants';
import {
  auditBureauEnquiriesInLastDays,
  auditMissedPayments,
  auditNoActiveMfiLoans,
  auditNoAdverseTradelineInLookback,
  auditNoRestructuredLoans,
  auditNoSmaPwosTradelines,
  auditNoWilfulDefault,
  buildPostBreBureauSummary,
  buildPostBreEnquiryInspection,
  buildPostBreTradelineInspection,
  checkBureauDpdRules,
  checkNoActiveMfiLoans,
  checkNoAdverseTradelineInLookback,
  checkNoRestructuredLoans,
  checkNoSmaPwosTradelines,
  checkNoWilfulDefault,
  countBureauEnquiriesInLastDays,
  evaluateBureauDpdRulesDetailed,
  resolveBureauAsOfDate,
  type BureauRuleFinding,
  type PostBreBureauSummary,
  type PostBreEnquiryInspectionRow,
  type PostBreTradelineInspectionRow,
} from '../cibil/cibil-bureau-rules.parser';
import {
  isCibilNewToCreditScore,
  parseTenacioBureauVendorBody,
} from '../vendor/tenacio-bureau-payload.mapper';
import { computeOpenUnsecuredExposureBreakdown } from '../cibil/cibil-tradeline.parser';
import { CreditLimitTierResolverService } from '../cibil/credit-limit-tier-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';
import { loadLoanAmountBounds } from './bre-settings.loader';
import {
  buildPostBreRulesCatalog,
  POST_BRE_ENQUIRY_WINDOW_DAYS,
  type PostBreRuleCatalogEntry,
  type PostBreRulesCatalog,
} from './post-bre-rules.catalog';
import {
  buildPostBreUnsecuredExposureGuide,
  type CreditLimitTierRef,
  type PostBreUnsecuredExposureGuide,
} from './post-bre-unsecured-guide';

export type { PostBreRuleCatalogEntry, PostBreRulesCatalog, PostBreUnsecuredExposureGuide, CreditLimitTierRef };

export interface PostBreCheckInput {
  leadId: bigint;
  customerId: bigint;
}

export interface PostBreCheckResult {
  passed: boolean;
  rejectReason: string | null;
  rejectionReasonCode: string | null;
  /** Bureau score used for the decision, when available. */
  cibilScore: number | null;
}

export type PostBreRuleFinding = BureauRuleFinding;

export type PostBreRuleCheck = {
  id: string;
  label: string;
  passed: boolean;
  rejectionReasonCode: string | null;
  detail: string | null;
  meta?: Record<string, string | number | boolean | null>;
  /** Eligibility criteria keys that drive this rule (from `eligibility_criteria`). */
  criteriaKeys?: string[];
  /** Per-account / per-signal evidence when the rule fails (or is informational). */
  findings?: PostBreRuleFinding[];
};

export type PostBreCriteriaConfigRow = {
  key: string;
  label: string;
  description: string | null;
  value: string;
  /** Whether this criterion is turned on for post-BRE in this run. */
  ruleEnabled: boolean;
  /** Post-BRE check ids that read this key when enabled. */
  appliesToCheckIds: string[];
};

export type PostBreInspection = {
  bureau: PostBreBureauSummary;
  criteria: PostBreCriteriaConfigRow[];
  tradelines: PostBreTradelineInspectionRow[];
  enquiries: PostBreEnquiryInspectionRow[];
};

export type PostBreDryRunResult = {
  overallPassed: boolean;
  cibilScore: number | null;
  isExistingCustomer: boolean;
  thresholds: PostBreThresholds;
  checks: PostBreRuleCheck[];
  inspection: PostBreInspection;
  /** Always populated when the bureau payload is parseable. */
  unsecuredExposure: {
    totalOpenUnsecuredExposureInr: number;
    maxOpenUnsecuredExposureInr: number;
  } | null;
  /** Populated only when overallPassed = true. */
  creditLimit: {
    preApprovedAmountInr: number;
    minLoanAmountInr: number;
    maxLoanAmountInr: number;
    totalOpenUnsecuredExposureInr: number;
    maxOpenUnsecuredExposureInr: number;
  } | null;
};

/** Maps eligibility_criteria.key → post-BRE check id(s). */
const POST_BRE_CRITERIA_TO_CHECKS: Record<string, string[]> = {
  [EC.CIBIL_MIN_NEW]: ['cibil_score_minimum'],
  [EC.CIBIL_MIN_EXISTING]: ['cibil_score_minimum'],
  [EC.SETTLED_MONTHS]: ['adverse_tradeline'],
  [EC.NO_RESTRUCTURED_LOANS]: [EC.NO_RESTRUCTURED_LOANS],
  [EC.NO_SMA_PWOS]: [EC.NO_SMA_PWOS],
  [EC.NO_ACTIVE_MFI]: [EC.NO_ACTIVE_MFI],
  [EC.MAX_ENQUIRIES_30_DAYS]: ['credit_enquiries'],
  [EC.OPEN_DPD_MONTHS]: ['dpd_open_dpd'],
  [EC.DPD_30PLUS_MONTHS]: ['dpd_dpd_30plus'],
  [EC.DPD_60PLUS_MONTHS]: ['dpd_dpd_60plus'],
  [EC.DPD_90PLUS_MONTHS]: ['dpd_dpd_90plus'],
  [EC.MAX_MISSED_PAYMENTS_6_MONTHS]: ['missed_payments_6_months'],
};

const DEFAULT_CIBIL_MIN_NEW = 700;
const DEFAULT_CIBIL_MIN_EXISTING = 650;
const DEFAULT_SETTLED_LOOKBACK_MONTHS = 18;
const DEFAULT_MAX_ENQUIRIES_30_DAYS = 10;
const DEFAULT_OPEN_DPD_MONTHS = 6;
const DEFAULT_DPD_30PLUS_MONTHS = 3;
const DEFAULT_DPD_60PLUS_MONTHS = 9;
const DEFAULT_DPD_90PLUS_MONTHS = 12;
const ENQUIRY_WINDOW_DAYS = POST_BRE_ENQUIRY_WINDOW_DAYS;

/**
 * Rules applied after a successful bureau pull (Tenacio soft-pull, etc.).
 */
@Injectable()
export class PostBreCheckService {
  private readonly logger = new Logger(PostBreCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditLimitTiers: CreditLimitTierResolverService,
  ) {}

  /** Reference catalog for LOS developer tools (live thresholds + rule conditions). */
  async getRulesCatalog(): Promise<{
    enquiryWindowDays: number;
    thresholds: PostBreThresholds;
    criteria: PostBreCriteriaConfigRow[];
    rules: PostBreRuleCatalogEntry[];
    unsecuredExposure: PostBreUnsecuredExposureGuide;
  }> {
    const thresholds = await this.loadPostBreThresholds();
    const criteria = await this.loadPostBreCriteriaConfig(thresholds);
    const { rules, enquiryWindowDays } = buildPostBreRulesCatalog(thresholds);
    const [tierRows, bounds] = await Promise.all([
      this.prisma.client.creditLimitTier.findMany({
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          minUnsecuredLoan: true,
          maxUnsecuredLoan: true,
          maxBulletLoan: true,
          sortOrder: true,
          isActive: true,
        },
      }),
      loadLoanAmountBounds(this.prisma),
    ]);
    const creditLimitTiers: CreditLimitTierRef[] = tierRows.map((t) => ({
      id: t.id,
      minUnsecuredLoan: t.minUnsecuredLoan,
      maxUnsecuredLoan: t.maxUnsecuredLoan,
      maxBulletLoan: t.maxBulletLoan,
      sortOrder: t.sortOrder,
      isActive: t.isActive,
    }));
    const unsecuredExposure = buildPostBreUnsecuredExposureGuide({
      creditLimitTiers,
      minLoanAmountInr: bounds.minLoanAmountInr,
      maxLoanAmountInr: bounds.maxLoanAmountInr,
    });
    return { enquiryWindowDays, thresholds, criteria, rules, unsecuredExposure };
  }

  /**
   * Dry-run post-BRE against pasted bureau JSON (LOS tooling).
   * Does not persist anything; returns every rule with pass/fail and reason.
   */
  async evaluateFromBureauPayload(input: {
    rawPayload: unknown;
    isExistingCustomer: boolean;
  }): Promise<PostBreDryRunResult> {
    const thresholds = await this.loadPostBreThresholds();
    const criteriaConfig = await this.loadPostBreCriteriaConfig(thresholds);
    const parsed = parseTenacioBureauVendorBody(input.rawPayload);
    const cibilScore = parsed.bureauScore;
    const bureauAsOf = resolveBureauAsOfDate(input.rawPayload);
    const checks: PostBreRuleCheck[] = [];
    const activeTradelineRuleIds: string[] = ['adverse_tradeline'];

    const push = (check: PostBreRuleCheck) => {
      checks.push(check);
    };

    push({
      id: 'bureau_score_present',
      label: 'Bureau score available',
      passed: cibilScore !== null,
      rejectionReasonCode: null,
      detail:
        cibilScore !== null
          ? `CIBIL / bureau score parsed: ${cibilScore}.`
          : 'No riskScore found in bureau payload (Borrower.CreditScore). Score-based rules are skipped in production when missing.',
      meta: { cibilScore },
      findings:
        cibilScore !== null
          ? [
              {
                title: 'Borrower.CreditScore.riskScore',
                detail: `Parsed bureau score: ${cibilScore}`,
                data: {
                  cibilScore,
                  jsonPath: 'data.cibilData.GetCustomerAssetsResponse…TrueLinkCreditReport.Borrower.CreditScore.riskScore',
                },
              },
            ]
          : [
              {
                title: 'Score path missing',
                detail: 'Expected riskScore under TrueLinkCreditReport → Borrower → CreditScore.',
                data: {
                  responseStatus: parsed.responseStatus,
                  vendorRequestId: parsed.vendorRequestId,
                },
              },
            ],
    });

    if (isCibilNewToCreditScore(cibilScore)) {
      push({
        id: 'new_to_credit',
        label: 'New to credit (NTC)',
        passed: false,
        rejectionReasonCode: REJECTION_REASON.NEW_TO_CREDIT,
        detail: `Bureau score is ${cibilScore} (new to credit).`,
        meta: { cibilScore },
        findings: [
          {
            title: 'NTC score',
            detail: 'CIBIL reports -1 or 0 when the borrower has no usable credit history.',
            data: { cibilScore },
          },
        ],
      });
    } else {
      push({
        id: 'new_to_credit',
        label: 'New to credit (NTC)',
        passed: true,
        rejectionReasonCode: null,
        detail: 'Score is not 0 or -1.',
        meta: { cibilScore },
      });
    }

    if (cibilScore !== null && !isCibilNewToCreditScore(cibilScore)) {
      const minScore = input.isExistingCustomer ? thresholds.cibilMinExisting : thresholds.cibilMinNew;
      const customerLabel = input.isExistingCustomer ? 'existing' : 'new';
      const scorePassed = cibilScore >= minScore;
      const gap = minScore - cibilScore;
      push({
        id: 'cibil_score_minimum',
        label: `Minimum CIBIL score (${customerLabel} customer)`,
        passed: scorePassed,
        rejectionReasonCode: scorePassed ? null : REJECTION_REASON.CIBIL_SCORE_LOW,
        detail: scorePassed
          ? `Score ${cibilScore} meets minimum ${minScore} for ${customerLabel} customers.`
          : `Score ${cibilScore} is below minimum ${minScore} for ${customerLabel} customers.`,
        meta: { cibilScore, minScore, customerType: customerLabel },
        criteriaKeys: [input.isExistingCustomer ? EC.CIBIL_MIN_EXISTING : EC.CIBIL_MIN_NEW],
        findings: scorePassed
          ? undefined
          : [
              {
                title: 'Score below threshold',
                detail: `Need at least ${minScore} for ${customerLabel} customers; shortfall of ${gap} point(s).`,
                data: {
                  cibilScore,
                  minScore,
                  gap,
                  customerType: customerLabel,
                  criterionKey: input.isExistingCustomer ? EC.CIBIL_MIN_EXISTING : EC.CIBIL_MIN_NEW,
                },
              },
            ],
      });
    }

    const wilfulDefault = auditNoWilfulDefault(input.rawPayload);
    push({
      id: 'no_wilful_default',
      label: 'No suit filed / wilful default (lifetime)',
      passed: wilfulDefault.passed,
      rejectionReasonCode: wilfulDefault.passed ? null : REJECTION_REASON.BUREAU_ADVERSE_TRADELINE,
      detail: wilfulDefault.passed
        ? 'No suit filed or wilful default on any bureau tradeline.'
        : wilfulDefault.detail,
      meta: { hitCount: wilfulDefault.findings.length },
      findings: wilfulDefault.passed ? undefined : wilfulDefault.findings,
    });

    const adverse = auditNoAdverseTradelineInLookback(
      input.rawPayload,
      thresholds.settledLookbackMonths,
      bureauAsOf,
    );
    push({
      id: 'adverse_tradeline',
      label: `No Doubtful / Loss / Written-off / Settled / Suit Filed (last ${thresholds.settledLookbackMonths} months)`,
      passed: adverse.passed,
      rejectionReasonCode: adverse.passed ? null : REJECTION_REASON.BUREAU_ADVERSE_TRADELINE,
      detail:
        adverse.detail ??
        (adverse.passed
          ? `No adverse tradeline signals (including suit filed / wilful default) in the last ${thresholds.settledLookbackMonths} months.`
          : `Adverse bureau tradeline status in the last ${thresholds.settledLookbackMonths} months.`),
      meta: { lookbackMonths: thresholds.settledLookbackMonths, hitCount: adverse.findings.length },
      criteriaKeys: [EC.SETTLED_MONTHS],
      findings: adverse.passed ? undefined : adverse.findings,
    });

    if (thresholds.enforceNoRestructuredLoans) {
      activeTradelineRuleIds.push(EC.NO_RESTRUCTURED_LOANS);
      const restructured = auditNoRestructuredLoans(input.rawPayload);
      push({
        id: EC.NO_RESTRUCTURED_LOANS,
        label: 'No restructured loans (TUEF Tag 33)',
        passed: restructured.passed,
        rejectionReasonCode: restructured.passed ? null : REJECTION_REASON.BUREAU_RESTRUCTURED_LOAN,
        detail: restructured.passed
          ? 'No restructured loan tradelines on bureau report.'
          : restructured.detail,
        meta: { hitCount: restructured.findings.length },
        criteriaKeys: [EC.NO_RESTRUCTURED_LOANS],
        findings: restructured.passed ? undefined : restructured.findings,
      });
    }

    if (thresholds.enforceNoSmaPwos) {
      activeTradelineRuleIds.push(EC.NO_SMA_PWOS);
      const smaPwos = auditNoSmaPwosTradelines(input.rawPayload);
      push({
        id: EC.NO_SMA_PWOS,
        label: 'No SMA or PWOS trade lines (TUEF asset class)',
        passed: smaPwos.passed,
        rejectionReasonCode: smaPwos.passed ? null : REJECTION_REASON.BUREAU_SMA_PWOS_TRADELINE,
        detail: smaPwos.passed
          ? 'No SMA / PWOS payment status on any tradeline.'
          : smaPwos.detail,
        meta: { hitCount: smaPwos.findings.length },
        criteriaKeys: [EC.NO_SMA_PWOS],
        findings: smaPwos.passed ? undefined : smaPwos.findings,
      });
    }

    if (thresholds.enforceNoActiveMfi) {
      activeTradelineRuleIds.push(EC.NO_ACTIVE_MFI);
      const mfi = auditNoActiveMfiLoans(input.rawPayload);
      push({
        id: EC.NO_ACTIVE_MFI,
        label: 'No active MFI / microfinance loans (Appendix A types 40–43)',
        passed: mfi.passed,
        rejectionReasonCode: mfi.passed ? null : REJECTION_REASON.BUREAU_ACTIVE_MFI_LOAN,
        detail: mfi.passed ? 'No open microfinance loan tradelines.' : mfi.detail,
        meta: { hitCount: mfi.findings.length },
        criteriaKeys: [EC.NO_ACTIVE_MFI],
        findings: mfi.passed ? undefined : mfi.findings,
      });
    }

    const enquiries = auditBureauEnquiriesInLastDays(
      input.rawPayload,
      ENQUIRY_WINDOW_DAYS,
      thresholds.maxEnquiries30Days,
    );
    push({
      id: 'credit_enquiries',
      label: `Not more than ${thresholds.maxEnquiries30Days} loan enquiries (last ${ENQUIRY_WINDOW_DAYS} days)`,
      passed: enquiries.passed,
      rejectionReasonCode: enquiries.passed ? null : REJECTION_REASON.BUREAU_ENQUIRIES_EXCEEDED,
      detail: enquiries.passed
        ? `${enquiries.count} loan enquiry(ies) within limit of ${thresholds.maxEnquiries30Days} (excludes credit-card-only and portfolio enquiry purposes per TUEF Appendix A).`
        : enquiries.detail,
      meta: {
        enquiryCount: enquiries.count,
        maxEnquiries: thresholds.maxEnquiries30Days,
        windowDays: ENQUIRY_WINDOW_DAYS,
      },
      criteriaKeys: [EC.MAX_ENQUIRIES_30_DAYS],
      findings: enquiries.passed
        ? enquiries.count > 0
          ? enquiries.findings
          : undefined
        : [
            {
              title: 'Enquiry limit exceeded',
              detail: `${enquiries.count} enquiries in window; maximum allowed is ${thresholds.maxEnquiries30Days}.`,
              data: {
                enquiryCount: enquiries.count,
                maxEnquiries: thresholds.maxEnquiries30Days,
                windowDays: ENQUIRY_WINDOW_DAYS,
              },
            },
            ...enquiries.findings,
          ],
    });

    const dpdThresholds = {
      openDpdMonths: thresholds.openDpdMonths,
      dpd30PlusMonths: thresholds.dpd30PlusMonths,
      dpd60PlusMonths: thresholds.dpd60PlusMonths,
      dpd90PlusMonths: thresholds.dpd90PlusMonths,
    };

    const dpdLabels: Record<string, string> = {
      dpd_90plus: `90+ DPD (last ${thresholds.dpd90PlusMonths} months)`,
      dpd_60plus: `60+ DPD (last ${thresholds.dpd60PlusMonths} months)`,
      dpd_30plus: `30+ DPD (last ${thresholds.dpd30PlusMonths} months)`,
      open_dpd: `Open loan DPD > 0 (last ${thresholds.openDpdMonths} months)`,
    };

    const dpdCriteriaKeys: Record<string, string> = {
      open_dpd: EC.OPEN_DPD_MONTHS,
      dpd_30plus: EC.DPD_30PLUS_MONTHS,
      dpd_60plus: EC.DPD_60PLUS_MONTHS,
      dpd_90plus: EC.DPD_90PLUS_MONTHS,
    };

    for (const dpdRule of evaluateBureauDpdRulesDetailed(input.rawPayload, dpdThresholds, bureauAsOf)) {
      const checkId = `dpd_${dpdRule.ruleKey}`;
      activeTradelineRuleIds.push(checkId);
      push({
        id: checkId,
        label: dpdLabels[dpdRule.ruleKey] ?? dpdRule.ruleKey,
        passed: dpdRule.passed,
        rejectionReasonCode: dpdRule.passed ? null : REJECTION_REASON.BUREAU_DPD_FAILED,
        detail:
          dpdRule.detail ??
          (dpdRule.passed ? 'No delinquency breach for this window.' : 'Bureau DPD rules failed.'),
        meta: { hitCount: dpdRule.findings.length },
        criteriaKeys: [dpdCriteriaKeys[dpdRule.ruleKey]],
        findings: dpdRule.passed ? undefined : dpdRule.findings,
      });
    }

    const missedPayments = auditMissedPayments(
      input.rawPayload,
      6,
      thresholds.maxMissedPayments6Months,
      bureauAsOf,
    );
    push({
      id: 'missed_payments_6_months',
      label: `Missed payments in last 6 months (max ${thresholds.maxMissedPayments6Months})`,
      passed: missedPayments.passed,
      rejectionReasonCode: missedPayments.passed ? null : REJECTION_REASON.BUREAU_DPD_FAILED,
      detail: missedPayments.detail ?? `${missedPayments.findings.length} missed payment(s) within limit of ${thresholds.maxMissedPayments6Months}.`,
      meta: {
        missedPaymentCount: missedPayments.findings.length,
        maxAllowed: thresholds.maxMissedPayments6Months,
        lookbackMonths: 6,
      },
      criteriaKeys: [EC.MAX_MISSED_PAYMENTS_6_MONTHS],
      findings: missedPayments.findings.length > 0 ? missedPayments.findings : undefined,
    });

    const blockingChecks = checks.filter(
      (c) =>
        c.id !== 'bureau_score_present' &&
        !c.passed,
    );
    const overallPassed = blockingChecks.length === 0;

    const uniqueTradelineRules = [...new Set(activeTradelineRuleIds)];
    const inspection: PostBreInspection = {
      bureau: buildPostBreBureauSummary(input.rawPayload, parsed, ENQUIRY_WINDOW_DAYS),
      criteria: criteriaConfig,
      tradelines: buildPostBreTradelineInspection(input.rawPayload, uniqueTradelineRules),
      enquiries: buildPostBreEnquiryInspection(input.rawPayload, ENQUIRY_WINDOW_DAYS),
    };

    let unsecuredExposure: PostBreDryRunResult['unsecuredExposure'] = null;
    let creditLimit: PostBreDryRunResult['creditLimit'] = null;
    try {
      const exposure = computeOpenUnsecuredExposureBreakdown(input.rawPayload);
      unsecuredExposure = {
        totalOpenUnsecuredExposureInr: exposure.totalOpenUnsecuredExposureInr,
        maxOpenUnsecuredExposureInr: exposure.maxOpenUnsecuredExposureInr,
      };
      if (overallPassed) {
        const [bounds, tier] = await Promise.all([
          loadLoanAmountBounds(this.prisma),
          this.creditLimitTiers.resolveMaxBulletLoan(exposure.totalOpenUnsecuredExposureInr),
        ]);
        if (tier) {
          const pre = Math.min(Math.max(tier.maxBulletLoan, bounds.minLoanAmountInr), bounds.maxLoanAmountInr);
          creditLimit = {
            preApprovedAmountInr: pre,
            minLoanAmountInr: bounds.minLoanAmountInr,
            maxLoanAmountInr: bounds.maxLoanAmountInr,
            totalOpenUnsecuredExposureInr: exposure.totalOpenUnsecuredExposureInr,
            maxOpenUnsecuredExposureInr: exposure.maxOpenUnsecuredExposureInr,
          };
        }
      }
    } catch {
      // non-blocking — continue without exposure/credit limit if payload unparseable
    }

    return {
      overallPassed,
      cibilScore,
      isExistingCustomer: input.isExistingCustomer,
      thresholds,
      checks,
      inspection,
      unsecuredExposure,
      creditLimit,
    };
  }

  async run(input: PostBreCheckInput): Promise<PostBreCheckResult> {
    const bureauRow = await this.findLatestBureauReportForLead(input.leadId);
    const cibilScore = bureauRow?.cibilScore ?? null;

    if (cibilScore === null) {
      this.logger.warn(`Post-BRE skipped score rules (leadId=${input.leadId.toString()}): no bureau score on file.`);
      return { passed: true, rejectReason: null, rejectionReasonCode: null, cibilScore: null };
    }

    if (isCibilNewToCreditScore(cibilScore)) {
      return {
        passed: false,
        rejectReason: `New to credit: bureau score is ${cibilScore} (NTC).`,
        rejectionReasonCode: REJECTION_REASON.NEW_TO_CREDIT,
        cibilScore,
      };
    }

    const thresholds = await this.loadPostBreThresholds();
    const isExistingCustomer = await this.customerHasDisbursedLoan(input.customerId);

    if (isExistingCustomer) {
      if (cibilScore < thresholds.cibilMinExisting) {
        return {
          passed: false,
          rejectReason: `CIBIL score ${cibilScore} is below minimum ${thresholds.cibilMinExisting} for existing customers.`,
          rejectionReasonCode: REJECTION_REASON.CIBIL_SCORE_LOW,
          cibilScore,
        };
      }
    } else if (cibilScore < thresholds.cibilMinNew) {
      return {
        passed: false,
        rejectReason: `CIBIL score ${cibilScore} is below minimum ${thresholds.cibilMinNew} for new customers.`,
        rejectionReasonCode: REJECTION_REASON.CIBIL_SCORE_LOW,
        cibilScore,
      };
    }

    if (bureauRow?.rawPayload != null) {
      const bureauRules = this.runBureauPayloadRules(bureauRow.rawPayload, thresholds);
      if (!bureauRules.passed) {
        return { ...bureauRules, cibilScore };
      }
    } else {
      this.logger.warn(
        `Post-BRE skipped tradeline/enquiry rules (leadId=${input.leadId.toString()}): no bureau raw payload.`,
      );
    }

    return { passed: true, rejectReason: null, rejectionReasonCode: null, cibilScore };
  }

  private runBureauPayloadRules(
    rawPayload: unknown,
    thresholds: PostBreThresholds,
  ): Pick<PostBreCheckResult, 'passed' | 'rejectReason' | 'rejectionReasonCode'> {
    const wilfulDefault = checkNoWilfulDefault(rawPayload);
    if (!wilfulDefault.passed) {
      return {
        passed: false,
        rejectReason: wilfulDefault.detail ?? 'Suit filed / wilful default found on bureau tradeline.',
        rejectionReasonCode: REJECTION_REASON.BUREAU_ADVERSE_TRADELINE,
      };
    }

    const adverse = checkNoAdverseTradelineInLookback(
      rawPayload,
      thresholds.settledLookbackMonths,
      resolveBureauAsOfDate(rawPayload),
    );
    if (!adverse.passed) {
      return {
        passed: false,
        rejectReason:
          adverse.detail ??
          `Adverse bureau tradeline status in the last ${thresholds.settledLookbackMonths} months.`,
        rejectionReasonCode: REJECTION_REASON.BUREAU_ADVERSE_TRADELINE,
      };
    }

    if (thresholds.enforceNoRestructuredLoans) {
      const restructured = checkNoRestructuredLoans(rawPayload);
      if (!restructured.passed) {
        return {
          passed: false,
          rejectReason: restructured.detail ?? 'Restructured loan tradeline on bureau report.',
          rejectionReasonCode: REJECTION_REASON.BUREAU_RESTRUCTURED_LOAN,
        };
      }
    }

    if (thresholds.enforceNoSmaPwos) {
      const smaPwos = checkNoSmaPwosTradelines(rawPayload);
      if (!smaPwos.passed) {
        return {
          passed: false,
          rejectReason: smaPwos.detail ?? 'SMA or PWOS tradeline on bureau report.',
          rejectionReasonCode: REJECTION_REASON.BUREAU_SMA_PWOS_TRADELINE,
        };
      }
    }

    if (thresholds.enforceNoActiveMfi) {
      const mfi = checkNoActiveMfiLoans(rawPayload);
      if (!mfi.passed) {
        return {
          passed: false,
          rejectReason: mfi.detail ?? 'Active microfinance (MFI) loan on bureau report.',
          rejectionReasonCode: REJECTION_REASON.BUREAU_ACTIVE_MFI_LOAN,
        };
      }
    }

    const enquiryCount = countBureauEnquiriesInLastDays(rawPayload, ENQUIRY_WINDOW_DAYS);
    if (enquiryCount > thresholds.maxEnquiries30Days) {
      return {
        passed: false,
        rejectReason: `Too many credit enquiries (${enquiryCount}) in the last ${ENQUIRY_WINDOW_DAYS} days (max ${thresholds.maxEnquiries30Days}).`,
        rejectionReasonCode: REJECTION_REASON.BUREAU_ENQUIRIES_EXCEEDED,
      };
    }

    const dpd = checkBureauDpdRules(
      rawPayload,
      {
        openDpdMonths: thresholds.openDpdMonths,
        dpd30PlusMonths: thresholds.dpd30PlusMonths,
        dpd60PlusMonths: thresholds.dpd60PlusMonths,
        dpd90PlusMonths: thresholds.dpd90PlusMonths,
      },
      resolveBureauAsOfDate(rawPayload),
    );
    if (!dpd.passed) {
      return {
        passed: false,
        rejectReason: dpd.detail ?? 'Bureau DPD rules failed.',
        rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      };
    }

    const missedPayments = auditMissedPayments(
      rawPayload,
      6,
      thresholds.maxMissedPayments6Months,
      resolveBureauAsOfDate(rawPayload),
    );
    if (!missedPayments.passed) {
      return {
        passed: false,
        rejectReason: missedPayments.detail ?? 'Too many missed payments in the last 6 months.',
        rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      };
    }

    return { passed: true, rejectReason: null, rejectionReasonCode: null };
  }

  private async findLatestBureauReportForLead(leadId: bigint): Promise<{
    cibilScore: number | null;
    rawPayload: unknown;
  } | null> {
    const client = this.prisma.client as unknown as {
      bureauReport: {
        findFirst: (args: {
          where: { leadId: bigint };
          orderBy: { createdAt: 'desc' };
          select: { cibilScore: true; rawPayload: true };
        }) => Promise<{ cibilScore: number | null; rawPayload: unknown } | null>;
      };
    };
    const row = await client.bureauReport.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: { cibilScore: true, rawPayload: true },
    });
    return row;
  }

  private async loadPostBreCriteriaConfig(
    thresholds: PostBreThresholds,
  ): Promise<PostBreCriteriaConfigRow[]> {
    const keys = Object.keys(POST_BRE_CRITERIA_TO_CHECKS);
    const rows = await this.prisma.client.eligibilityCriteria.findMany({
      where: { key: { in: keys }, isActive: true },
      select: { key: true, label: true, description: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r]));

    const ruleEnabledForKey = (key: string): boolean => {
      switch (key) {
        case EC.NO_RESTRUCTURED_LOANS:
          return thresholds.enforceNoRestructuredLoans;
        case EC.NO_SMA_PWOS:
          return thresholds.enforceNoSmaPwos;
        case EC.NO_ACTIVE_MFI:
          return thresholds.enforceNoActiveMfi;
        default:
          return true;
      }
    };

    const valueForKey = (key: string): string => {
      switch (key) {
        case EC.CIBIL_MIN_NEW:
          return String(thresholds.cibilMinNew);
        case EC.CIBIL_MIN_EXISTING:
          return String(thresholds.cibilMinExisting);
        case EC.SETTLED_MONTHS:
          return String(thresholds.settledLookbackMonths);
        case EC.MAX_ENQUIRIES_30_DAYS:
          return String(thresholds.maxEnquiries30Days);
        case EC.OPEN_DPD_MONTHS:
          return String(thresholds.openDpdMonths);
        case EC.DPD_30PLUS_MONTHS:
          return String(thresholds.dpd30PlusMonths);
        case EC.DPD_60PLUS_MONTHS:
          return String(thresholds.dpd60PlusMonths);
        case EC.DPD_90PLUS_MONTHS:
          return String(thresholds.dpd90PlusMonths);
        case EC.NO_RESTRUCTURED_LOANS:
          return thresholds.enforceNoRestructuredLoans ? 'true' : 'false';
        case EC.NO_SMA_PWOS:
          return thresholds.enforceNoSmaPwos ? 'true' : 'false';
        case EC.NO_ACTIVE_MFI:
          return thresholds.enforceNoActiveMfi ? 'true' : 'false';
        default:
          return map.get(key)?.value ?? '';
      }
    };

    return keys.map((key) => {
      const row = map.get(key);
      return {
        key,
        label: row?.label ?? key,
        description: row?.description ?? null,
        value: valueForKey(key),
        ruleEnabled: ruleEnabledForKey(key),
        appliesToCheckIds: POST_BRE_CRITERIA_TO_CHECKS[key] ?? [],
      };
    });
  }

  private async loadPostBreThresholds(): Promise<PostBreThresholds> {
    const keys = [
      EC.CIBIL_MIN_NEW,
      EC.CIBIL_MIN_EXISTING,
      EC.SETTLED_MONTHS,
      EC.MAX_ENQUIRIES_30_DAYS,
      EC.OPEN_DPD_MONTHS,
      EC.DPD_30PLUS_MONTHS,
      EC.DPD_60PLUS_MONTHS,
      EC.DPD_90PLUS_MONTHS,
      EC.NO_RESTRUCTURED_LOANS,
      EC.NO_SMA_PWOS,
      EC.NO_ACTIVE_MFI,
      EC.MAX_MISSED_PAYMENTS_6_MONTHS,
    ] as const;
    const rows = await this.prisma.client.eligibilityCriteria.findMany({
      where: { key: { in: [...keys] }, isActive: true },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const pickInt = (key: (typeof keys)[number], fallback: number) => {
      const raw = map.get(key)?.trim();
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      return Number.isFinite(n) ? n : fallback;
    };
    const pickBool = (key: (typeof keys)[number], fallback: boolean) => {
      const raw = map.get(key)?.trim().toLowerCase();
      if (raw === 'false' || raw === '0' || raw === 'no') return false;
      if (raw === 'true' || raw === '1' || raw === 'yes') return true;
      return fallback;
    };
    return {
      cibilMinNew: pickInt(EC.CIBIL_MIN_NEW, DEFAULT_CIBIL_MIN_NEW),
      cibilMinExisting: pickInt(EC.CIBIL_MIN_EXISTING, DEFAULT_CIBIL_MIN_EXISTING),
      settledLookbackMonths: pickInt(EC.SETTLED_MONTHS, DEFAULT_SETTLED_LOOKBACK_MONTHS),
      maxEnquiries30Days: pickInt(EC.MAX_ENQUIRIES_30_DAYS, DEFAULT_MAX_ENQUIRIES_30_DAYS),
      openDpdMonths: pickInt(EC.OPEN_DPD_MONTHS, DEFAULT_OPEN_DPD_MONTHS),
      dpd30PlusMonths: pickInt(EC.DPD_30PLUS_MONTHS, DEFAULT_DPD_30PLUS_MONTHS),
      dpd60PlusMonths: pickInt(EC.DPD_60PLUS_MONTHS, DEFAULT_DPD_60PLUS_MONTHS),
      dpd90PlusMonths: pickInt(EC.DPD_90PLUS_MONTHS, DEFAULT_DPD_90PLUS_MONTHS),
      enforceNoRestructuredLoans: pickBool(EC.NO_RESTRUCTURED_LOANS, true),
      enforceNoSmaPwos: pickBool(EC.NO_SMA_PWOS, true),
      enforceNoActiveMfi: pickBool(EC.NO_ACTIVE_MFI, true),
      maxMissedPayments6Months: pickInt(EC.MAX_MISSED_PAYMENTS_6_MONTHS, 1),
    };
  }

  /** True when the customer has at least one fully disbursed loan (repeat borrower). */
  private async customerHasDisbursedLoan(customerId: bigint): Promise<boolean> {
    const row = await this.prisma.client.application.findFirst({
      where: {
        customerId,
        applicationStatus: { name: APPLICATION_STATUS.DISBURSED, isActive: true },
      },
      select: { id: true },
    });
    return row != null;
  }
}

export type PostBreThresholds = import('./post-bre-rules.catalog').PostBreThresholdsSnapshot;

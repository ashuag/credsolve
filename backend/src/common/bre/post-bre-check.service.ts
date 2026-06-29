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
  parseBureauReport,
  type BureauRuleFinding,
  type PostBreBureauSummary,
  type PostBreEnquiryInspectionRow,
  type PostBreTradelineInspectionRow,
} from '../cibil/cibil-bureau-rules.parser';
import {
  isCibilNewToCreditScore,
  parseTenacioBureauVendorBody,
} from '../vendor/tenacio-bureau-payload.mapper';
import { extractCibilReportData } from '../cibil/cibil-report-data.extractor';
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
    const postBreRows = await this.loadPostBreRows();
    const thresholds = this.buildPostBreThresholds(postBreRows);
    const criteria = this.buildPostBreCriteriaConfig(postBreRows, thresholds);
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
    const postBreRows = await this.loadPostBreRows();
    const thresholds = this.buildPostBreThresholds(postBreRows);
    const criteriaConfig = this.buildPostBreCriteriaConfig(postBreRows, thresholds);
    
    const parsed = parseTenacioBureauVendorBody(input.rawPayload);
    const cibilScore = parsed.bureauScore;
    const parsedReport = parseBureauReport(input.rawPayload);
    const bureauAsOf = parsedReport.bureauAsOfDate;
    const checks: PostBreRuleCheck[] = [];
    const activeTradelineRuleIds: string[] = [EC.SETTLED_MONTHS];

    const push = (check: PostBreRuleCheck) => {
      checks.push(check);
    };

    push({
      id: 'bureau_score_present',
      label: 'Bureau score available',
      passed: cibilScore !== null,
      rejectionReasonCode: null,
      detail: cibilScore !== null
        ? `Bureau score parsed successfully: ${cibilScore}.`
        : 'No bureau score found in payload.',
      meta: { cibilScore },
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
            detail: 'CIBIL reports -1, 0 or 1 OR NULL when the borrower has no usable credit history.',
            data: { cibilScore },
          },
        ],
      });
      const inspection: PostBreInspection = {
        bureau: buildPostBreBureauSummary(parsedReport, parsed, ENQUIRY_WINDOW_DAYS),
        criteria: criteriaConfig,
        tradelines: buildPostBreTradelineInspection(parsedReport, []),
        enquiries: buildPostBreEnquiryInspection(parsedReport, ENQUIRY_WINDOW_DAYS),
      };

      return {
        overallPassed: false,
        cibilScore,
        isExistingCustomer: input.isExistingCustomer,
        thresholds,
        checks,
        inspection,
        unsecuredExposure: null,
        creditLimit: null,
      };
    } else {
      push({
        id: 'new_to_credit',
        label: 'New to credit (NTC)',
        passed: true,
        rejectionReasonCode: null,
        detail: 'Score is not 0, 1, -1 OR null',
        meta: { cibilScore },
      });
    }

    if (cibilScore !== null) {
      const minScore = input.isExistingCustomer ? thresholds.cibilMinExisting : thresholds.cibilMinNew;
      const customerLabel = input.isExistingCustomer ? 'existing' : 'new';
      const scorePassed = cibilScore >= minScore;
      const gap = minScore - cibilScore;
      push({
        id: input.isExistingCustomer ? EC.CIBIL_MIN_EXISTING : EC.CIBIL_MIN_NEW,
        label: `Minimum CIBIL score (${customerLabel} customer)`,
        passed: scorePassed,
        rejectionReasonCode: scorePassed ? null : REJECTION_REASON.CIBIL_SCORE_LOW,
        detail: scorePassed
          ? `Score ${cibilScore} meets minimum ${minScore} for ${customerLabel} customers.`
          : `Score ${cibilScore} is below minimum ${minScore} for ${customerLabel} customers.`,
        meta: { cibilScore, minScore, customerType: customerLabel },
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

    const enquiries = auditBureauEnquiriesInLastDays(
      parsedReport,
      ENQUIRY_WINDOW_DAYS,
      thresholds.maxEnquiries30Days,
    );
    push({
      id: EC.MAX_ENQUIRIES_30_DAYS,
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

    const missedPayments = auditMissedPayments(
      parsedReport,
      6,
      thresholds.maxMissedPayments6Months,
      bureauAsOf,
    );
    push({
      id: EC.MAX_MISSED_PAYMENTS_6_MONTHS,
      label: `Missed payments in last 6 months (max ${thresholds.maxMissedPayments6Months})`,
      passed: missedPayments.passed,
      rejectionReasonCode: missedPayments.passed ? null : REJECTION_REASON.BUREAU_DPD_FAILED,
      detail: missedPayments.detail ?? (
        missedPayments.passed
          ? `${missedPayments.findings.length} missed payment(s) within limit of ${thresholds.maxMissedPayments6Months}.`
          : `Too many missed payments (${missedPayments.findings.length}) in the last 6 months; maximum allowed is ${thresholds.maxMissedPayments6Months}.`
      ),
      meta: {
        missedPaymentCount: missedPayments.findings.length,
        maxAllowed: thresholds.maxMissedPayments6Months,
        lookbackMonths: 6,
      },
      findings: missedPayments.findings.length > 0 ? missedPayments.findings : undefined,
    });

    if (thresholds.enforceNoActiveMfi) {
      activeTradelineRuleIds.push(EC.NO_ACTIVE_MFI);
      const mfi = auditNoActiveMfiLoans(parsedReport);
      push({
        id: EC.NO_ACTIVE_MFI,
        label: 'No active MFI / microfinance loans',
        passed: mfi.passed,
        rejectionReasonCode: mfi.passed ? null : REJECTION_REASON.BUREAU_ACTIVE_MFI_LOAN,
        detail: mfi.passed ? 'No open microfinance loan tradelines.' : mfi.detail,
        meta: { hitCount: mfi.findings.length },
        criteriaKeys: [EC.NO_ACTIVE_MFI],
        findings: mfi.passed ? undefined : mfi.findings,
      });
    }

    const wilfulDefault = auditNoWilfulDefault(parsedReport);
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
      parsedReport,
      thresholds.settledLookbackMonths,
      bureauAsOf,
    );
    push({
      id: EC.SETTLED_MONTHS,
      label: `No Doubtful / Loss / Written-off / Settled / Suit Filed (last ${thresholds.settledLookbackMonths} months)`,
      passed: adverse.passed,
      rejectionReasonCode: adverse.passed ? null : REJECTION_REASON.BUREAU_ADVERSE_TRADELINE,
      detail:
        adverse.detail ??
        (adverse.passed
          ? `No adverse tradeline signals (including suit filed / wilful default) in the last ${thresholds.settledLookbackMonths} months.`
          : `Adverse bureau tradeline status in the last ${thresholds.settledLookbackMonths} months.`),
      meta: { lookbackMonths: thresholds.settledLookbackMonths, hitCount: adverse.findings.length },
      findings: adverse.passed ? undefined : adverse.findings,
    });

    if (thresholds.enforceNoRestructuredLoans) {
      activeTradelineRuleIds.push(EC.NO_RESTRUCTURED_LOANS);
      const restructured = auditNoRestructuredLoans(parsedReport);
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
      const smaPwos = auditNoSmaPwosTradelines(parsedReport);
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

    const dpdThresholds = {
      openDpdMonths: thresholds.openDpdMonths,
      dpd30PlusMonths: thresholds.dpd30PlusMonths,
      dpd60PlusMonths: thresholds.dpd60PlusMonths,
      dpd90PlusMonths: thresholds.dpd90PlusMonths,
    };

    const dpdLabels: Record<string, string> = {
      [EC.DPD_90PLUS_MONTHS]: `90+ DPD (last ${thresholds.dpd90PlusMonths} months)`,
      [EC.DPD_60PLUS_MONTHS]: `60+ DPD (last ${thresholds.dpd60PlusMonths} months)`,
      [EC.DPD_30PLUS_MONTHS]: `30+ DPD (last ${thresholds.dpd30PlusMonths} months)`,
      [EC.OPEN_DPD_MONTHS]: `Open loan DPD > 0 (last ${thresholds.openDpdMonths} months)`,
    };

    for (const dpdRule of evaluateBureauDpdRulesDetailed(parsedReport, dpdThresholds, bureauAsOf)) {
      activeTradelineRuleIds.push(dpdRule.ruleKey);
      push({
        id: dpdRule.ruleKey,
        label: dpdLabels[dpdRule.ruleKey] ?? dpdRule.ruleKey,
        passed: dpdRule.passed,
        rejectionReasonCode: dpdRule.passed ? null : REJECTION_REASON.BUREAU_DPD_FAILED,
        detail:
          dpdRule.detail ??
          (dpdRule.passed ? 'No delinquency breach for this window.' : 'Bureau DPD rules failed.'),
        meta: { hitCount: dpdRule.findings.length },
        findings: dpdRule.passed ? undefined : dpdRule.findings,
      });
    }

    const blockingChecks = checks.filter(
      (c) =>
        c.id !== 'bureau_score_present' &&
        !c.passed,
    );
    const overallPassed = blockingChecks.length === 0;

    const uniqueTradelineRules = [...new Set(activeTradelineRuleIds)];
    const inspection: PostBreInspection = {
      bureau: buildPostBreBureauSummary(parsedReport, parsed, ENQUIRY_WINDOW_DAYS),
      criteria: criteriaConfig,
      tradelines: buildPostBreTradelineInspection(parsedReport, uniqueTradelineRules),
      enquiries: buildPostBreEnquiryInspection(parsedReport, ENQUIRY_WINDOW_DAYS),
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
    const [bureauRow, lead] = await Promise.all([
      this.findLatestBureauReportForLead(input.leadId),
      this.prisma.client.lead.findUnique({
        where: { id: input.leadId },
        select: {
          leadDetail: { select: { panNumber: true, dateOfBirth: true } },
        },
      }),
    ]);

    if (bureauRow?.rawPayload != null && lead != null) {
      const identityCheck = this.checkBureauIdentity(bureauRow.rawPayload, lead);
      if (!identityCheck.passed) {
        return {
          passed: false,
          rejectReason: identityCheck.rejectReason,
          rejectionReasonCode: REJECTION_REASON.BUREAU_IDENTITY_MISMATCH,
          cibilScore: bureauRow.cibilScore ?? null,
        };
      }
    }

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

    const [postBreRows, isExistingCustomer] = await Promise.all([
      this.loadPostBreRows(),
      this.customerHasDisbursedLoan(input.customerId),
    ]);
    const thresholds = this.buildPostBreThresholds(postBreRows);

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
    const parsedReport = parseBureauReport(rawPayload);
    const wilfulDefault = checkNoWilfulDefault(parsedReport);
    if (!wilfulDefault.passed) {
      return {
        passed: false,
        rejectReason: wilfulDefault.detail ?? 'Suit filed / wilful default found on bureau tradeline.',
        rejectionReasonCode: REJECTION_REASON.BUREAU_ADVERSE_TRADELINE,
      };
    }

    const adverse = checkNoAdverseTradelineInLookback(
      parsedReport,
      thresholds.settledLookbackMonths,
      parsedReport.bureauAsOfDate,
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
      const restructured = checkNoRestructuredLoans(parsedReport);
      if (!restructured.passed) {
        return {
          passed: false,
          rejectReason: restructured.detail ?? 'Restructured loan tradeline on bureau report.',
          rejectionReasonCode: REJECTION_REASON.BUREAU_RESTRUCTURED_LOAN,
        };
      }
    }

    if (thresholds.enforceNoSmaPwos) {
      const smaPwos = checkNoSmaPwosTradelines(parsedReport);
      if (!smaPwos.passed) {
        return {
          passed: false,
          rejectReason: smaPwos.detail ?? 'SMA or PWOS tradeline on bureau report.',
          rejectionReasonCode: REJECTION_REASON.BUREAU_SMA_PWOS_TRADELINE,
        };
      }
    }

    if (thresholds.enforceNoActiveMfi) {
      const mfi = checkNoActiveMfiLoans(parsedReport);
      if (!mfi.passed) {
        return {
          passed: false,
          rejectReason: mfi.detail ?? 'Active microfinance (MFI) loan on bureau report.',
          rejectionReasonCode: REJECTION_REASON.BUREAU_ACTIVE_MFI_LOAN,
        };
      }
    }

    const enquiryCount = countBureauEnquiriesInLastDays(parsedReport, ENQUIRY_WINDOW_DAYS);
    if (enquiryCount > thresholds.maxEnquiries30Days) {
      return {
        passed: false,
        rejectReason: `Too many credit enquiries (${enquiryCount}) in the last ${ENQUIRY_WINDOW_DAYS} days (max ${thresholds.maxEnquiries30Days}).`,
        rejectionReasonCode: REJECTION_REASON.BUREAU_ENQUIRIES_EXCEEDED,
      };
    }

    const dpd = checkBureauDpdRules(
      parsedReport,
      {
        openDpdMonths: thresholds.openDpdMonths,
        dpd30PlusMonths: thresholds.dpd30PlusMonths,
        dpd60PlusMonths: thresholds.dpd60PlusMonths,
        dpd90PlusMonths: thresholds.dpd90PlusMonths,
      },
      parsedReport.bureauAsOfDate,
    );
    if (!dpd.passed) {
      return {
        passed: false,
        rejectReason: dpd.detail ?? 'Bureau DPD rules failed.',
        rejectionReasonCode: REJECTION_REASON.BUREAU_DPD_FAILED,
      };
    }

    const missedPayments = auditMissedPayments(
      parsedReport,
      6,
      thresholds.maxMissedPayments6Months,
      parsedReport.bureauAsOfDate,
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

  private checkBureauIdentity(
    rawPayload: unknown,
    lead: { leadDetail: { panNumber: string | null; dateOfBirth: Date | null } | null },
  ): { passed: boolean; rejectReason: string } {
    let reportData: ReturnType<typeof extractCibilReportData>;
    try {
      reportData = extractCibilReportData(rawPayload);
    } catch {
      return { passed: true, rejectReason: '' };
    }

    const leadPan = lead.leadDetail?.panNumber?.trim().toUpperCase() ?? null;
    const reportPan = reportData.pan?.trim().toUpperCase() ?? null;
    if (leadPan && reportPan && leadPan !== reportPan) {
      return {
        passed: false,
        rejectReason: `Bureau PAN mismatch: entered ${leadPan} but bureau report contains ${reportPan}.`,
      };
    }

    const leadDob = lead.leadDetail?.dateOfBirth;
    const reportDobStr = reportData.dateOfBirth;
    if (leadDob && reportDobStr) {
      const leadDobIso = leadDob.toISOString().slice(0, 10);
      if (leadDobIso !== reportDobStr) {
        return {
          passed: false,
          rejectReason: `Bureau DOB mismatch: entered ${leadDobIso} but bureau report contains ${reportDobStr}.`,
        };
      }
    }

    return { passed: true, rejectReason: '' };
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

  private async loadPostBreRows(): Promise<{ key: string; label: string; description: string | null; value: string }[]> {
    return this.prisma.client.eligibilityCriteria.findMany({
      where: { breType: 'POST_BRE', isActive: true },
      select: { key: true, label: true, description: true, value: true },
    });
  }

  private buildPostBreCriteriaConfig(
    rows: { key: string; label: string; description: string | null; value: string }[],
    thresholds: PostBreThresholds,
  ): PostBreCriteriaConfigRow[] {
    const ruleEnabledForKey = (key: string): boolean => {
      switch (key) {
        case EC.NO_RESTRUCTURED_LOANS: return thresholds.enforceNoRestructuredLoans;
        case EC.NO_SMA_PWOS: return thresholds.enforceNoSmaPwos;
        case EC.NO_ACTIVE_MFI: return thresholds.enforceNoActiveMfi;
        default: return true;
      }
    };

    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      description: row.description,
      value: row.value,
      ruleEnabled: ruleEnabledForKey(row.key),
    }));
  }

  private buildPostBreThresholds(rows: { key: string; value: string }[]): PostBreThresholds {
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const pickInt = (key: string) => {
      const raw = map.get(key)?.trim();
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (!Number.isFinite(n)) throw new Error(`Missing or invalid eligibility_criteria: ${key}`);
      return n;
    };
    const FALSY = new Set(['false', '0', 'no']);
    const TRUTHY = new Set(['true', '1', 'yes']);
    const pickBool = (key: string) => {
      const raw = map.get(key)?.trim().toLowerCase();
      if (FALSY.has(raw!)) return false;
      if (TRUTHY.has(raw!)) return true;
      throw new Error(`Missing or invalid eligibility_criteria: ${key}`);
    };
    return {
      cibilMinNew: pickInt(EC.CIBIL_MIN_NEW),
      cibilMinExisting: pickInt(EC.CIBIL_MIN_EXISTING),
      settledLookbackMonths: pickInt(EC.SETTLED_MONTHS),
      maxEnquiries30Days: pickInt(EC.MAX_ENQUIRIES_30_DAYS),
      openDpdMonths: pickInt(EC.OPEN_DPD_MONTHS),
      dpd30PlusMonths: pickInt(EC.DPD_30PLUS_MONTHS),
      dpd60PlusMonths: pickInt(EC.DPD_60PLUS_MONTHS),
      dpd90PlusMonths: pickInt(EC.DPD_90PLUS_MONTHS),
      enforceNoRestructuredLoans: pickBool(EC.NO_RESTRUCTURED_LOANS),
      enforceNoSmaPwos: pickBool(EC.NO_SMA_PWOS),
      enforceNoActiveMfi: pickBool(EC.NO_ACTIVE_MFI),
      maxMissedPayments6Months: pickInt(EC.MAX_MISSED_PAYMENTS_6_MONTHS),
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

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
  computeCibilAssessmentSignals,
  countBureauEnquiriesInLastDays,
  evaluateBureauDpdRulesDetailed,
  resolveBureauAsOfDate,
  parseBureauReport,
  type BureauRuleFinding,
  type PostBreBureauSummary,
  type PostBreEnquiryInspectionRow,
  type PostBreTradelineInspectionRow,
} from '../cibil/cibil-bureau-rules.parser';
import { assignCibilCategory } from '../cibil/cibil-credit-assessment.engine';
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
    totalUnsecuredExposureInr: number;
    totalOpenUnsecuredExposureInr: number;
    maxOpenUnsecuredExposureInr: number;
  } | null;
  /** Populated only when overallPassed = true. */
  creditLimit: {
    preApprovedAmountInr: number;
    minLoanAmountInr: number;
    maxLoanAmountInr: number;
    totalUnsecuredExposureInr: number;
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
    const postBreRows = await this.loadPostBreRows(this.prisma.read);
    const thresholds = this.buildPostBreThresholds(postBreRows);
    const criteria = this.buildPostBreCriteriaConfig(postBreRows, thresholds);
    const { rules, enquiryWindowDays } = buildPostBreRulesCatalog(thresholds);
    const [tierRows, bounds] = await Promise.all([
      this.prisma.read.creditLimitTier.findMany({
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
      loadLoanAmountBounds({ client: this.prisma.read }),
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
    /** Optional; when set, dry-run evaluates bureau phone match against this mobile. */
    applicantMobile?: string | null;
  }): Promise<PostBreDryRunResult> {
    const postBreRows = await this.loadPostBreRows(this.prisma.read);
    const thresholds = this.buildPostBreThresholds(postBreRows);
    const criteriaConfig = this.buildPostBreCriteriaConfig(postBreRows, thresholds);
    
    const parsed = parseTenacioBureauVendorBody(input.rawPayload);
    const cibilScore = parsed.bureauScore;
    const parsedReport = parseBureauReport(input.rawPayload);
    const bureauAsOf = parsedReport.bureauAsOfDate;
    const checks: PostBreRuleCheck[] = [];
    const activeTradelineRuleIds: string[] = [];

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

    const applicantMobile = input.applicantMobile?.trim() || null;
    if (applicantMobile) {
      const phoneCheck = this.checkBureauPhoneMatch(input.rawPayload, applicantMobile);
      push({
        id: 'bureau_phone_match',
        label: 'Applicant phone matches bureau report',
        passed: phoneCheck.passed,
        rejectionReasonCode: phoneCheck.passed ? null : REJECTION_REASON.BUREAU_PHONE_MISMATCH,
        detail: phoneCheck.detail,
        meta: { applicantMobile },
        findings: phoneCheck.passed
          ? undefined
          : [
              {
                title: 'Phone mismatch',
                detail: phoneCheck.rejectReason,
                data: { applicantMobile },
              },
            ],
      });
    } else {
      push({
        id: 'bureau_phone_match',
        label: 'Applicant phone matches bureau report',
        passed: true,
        rejectionReasonCode: null,
        detail: 'Skipped: no applicant mobile provided for dry-run comparison.',
        meta: { applicantMobile: null },
      });
    }

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
      if (minScore != null) {
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
    }

    const rejectedGrades = input.isExistingCustomer
      ? thresholds.rejectedCreditAssessmentGradesExisting
      : thresholds.rejectedCreditAssessmentGradesNew;
    if (rejectedGrades != null) {
      const customerLabel = input.isExistingCustomer ? 'recurring' : 'new';
      const gradeKey = input.isExistingCustomer
        ? EC.REJECTED_CREDIT_ASSESSMENT_GRADES_EXISTING
        : EC.REJECTED_CREDIT_ASSESSMENT_GRADES_NEW;
      const grade = this.resolveCreditAssessmentGrade(input.rawPayload, cibilScore);
      const blocked = grade != null && rejectedGrades.includes(grade);
      const gradeList = rejectedGrades.join(', ') || 'none';
      push({
        id: gradeKey,
        label: `Rejected credit assessment grades (${customerLabel} customers)`,
        passed: !blocked,
        rejectionReasonCode: blocked ? REJECTION_REASON.CREDIT_ASSESSMENT_GRADE_FAILED : null,
        detail: blocked
          ? `Credit assessment grade ${grade} is in the rejected set (${gradeList}) for ${customerLabel} customers.`
          : grade
            ? `Credit assessment grade ${grade} is not in the rejected set (${gradeList}) for ${customerLabel} customers.`
            : `Credit assessment grade could not be computed; rejected set is ${gradeList} for ${customerLabel} customers.`,
        meta: {
          creditAssessmentGrade: grade,
          rejectedGrades: gradeList,
          customerType: customerLabel,
        },
        criteriaKeys: [gradeKey],
        findings: blocked
          ? [
              {
                title: 'Rejected credit assessment grade',
                detail: `Grade ${grade} is blocked for ${customerLabel} customers. Blocked grades: ${gradeList}.`,
                data: {
                  creditAssessmentGrade: grade,
                  rejectedGrades: gradeList,
                  customerType: customerLabel,
                  criterionKey: gradeKey,
                },
              },
            ]
          : undefined,
      });
    }

    if (thresholds.maxEnquiries30Days != null) {
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
    }

    if (thresholds.maxMissedPayments6Months != null) {
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
    }

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

    if (thresholds.settledLookbackMonths != null) {
      activeTradelineRuleIds.push(EC.SETTLED_MONTHS);
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
    }

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
      [EC.DPD_90PLUS_MONTHS]:
        thresholds.dpd90PlusMonths != null ? `90+ DPD (last ${thresholds.dpd90PlusMonths} months)` : '90+ DPD',
      [EC.DPD_60PLUS_MONTHS]:
        thresholds.dpd60PlusMonths != null ? `60+ DPD (last ${thresholds.dpd60PlusMonths} months)` : '60+ DPD',
      [EC.DPD_30PLUS_MONTHS]:
        thresholds.dpd30PlusMonths != null ? `30+ DPD (last ${thresholds.dpd30PlusMonths} months)` : '30+ DPD',
      [EC.OPEN_DPD_MONTHS]:
        thresholds.openDpdMonths != null ? `Open loan DPD > 0 (last ${thresholds.openDpdMonths} months)` : 'Open loan DPD',
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

    const exposure = computeOpenUnsecuredExposureBreakdown(input.rawPayload);
    if (thresholds.minUnsecuredLoanAmount != null) {
      activeTradelineRuleIds.push(EC.MIN_UNSECURED_LOAN_AMOUNT);
      const minAmount = thresholds.minUnsecuredLoanAmount;
      const total = exposure.totalUnsecuredExposureInr;
      const passed = total >= minAmount;
      const shortfall = minAmount - total;
      push({
        id: EC.MIN_UNSECURED_LOAN_AMOUNT,
        label: `Minimum total unsecured loan amount (₹${minAmount})`,
        passed,
        rejectionReasonCode: passed ? null : REJECTION_REASON.MIN_UNSECURED_LOAN_AMOUNT_FAILED,
        detail: passed
          ? `Total unsecured exposure ${total} INR meets minimum ${minAmount} INR.`
          : `Total unsecured exposure ${total} INR is below minimum ${minAmount} INR.`,
        meta: {
          totalUnsecuredExposureInr: total,
          minUnsecuredLoanAmount: minAmount,
          unsecuredTradelineCount: exposure.lines.length,
        },
        criteriaKeys: [EC.MIN_UNSECURED_LOAN_AMOUNT],
        findings: passed
          ? undefined
          : [
              {
                title: 'Unsecured exposure below minimum',
                detail: `Need at least ${minAmount} INR total unsecured exposure; shortfall of ${shortfall} INR.`,
                data: {
                  totalUnsecuredExposureInr: total,
                  minUnsecuredLoanAmount: minAmount,
                  shortfallInr: shortfall,
                  unsecuredTradelineCount: exposure.lines.length,
                },
              },
              ...exposure.lines.map((line) => ({
                title: line.creditorName,
                detail: `${line.accountTypeLabel} · ${line.accountNumber} · ${line.exposureInr} INR`,
                data: {
                  accountNumber: line.accountNumber,
                  accountTypeSymbol: line.accountTypeSymbol,
                  exposureInr: line.exposureInr,
                },
              })),
            ],
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

    let creditLimit: PostBreDryRunResult['creditLimit'] = null;
    const unsecuredExposure: PostBreDryRunResult['unsecuredExposure'] = {
      totalUnsecuredExposureInr: exposure.totalUnsecuredExposureInr,
      totalOpenUnsecuredExposureInr: exposure.totalOpenUnsecuredExposureInr,
      maxOpenUnsecuredExposureInr: exposure.maxOpenUnsecuredExposureInr,
    };
    if (overallPassed) {
      try {
        const [bounds, tier] = await Promise.all([
          loadLoanAmountBounds({ client: this.prisma.read }),
          this.creditLimitTiers.resolveMaxBulletLoan(exposure.totalUnsecuredExposureInr),
        ]);
        if (tier) {
          const pre = Math.min(Math.max(tier.maxBulletLoan, bounds.minLoanAmountInr), bounds.maxLoanAmountInr);
          creditLimit = {
            preApprovedAmountInr: pre,
            minLoanAmountInr: bounds.minLoanAmountInr,
            maxLoanAmountInr: bounds.maxLoanAmountInr,
            totalUnsecuredExposureInr: exposure.totalUnsecuredExposureInr,
            totalOpenUnsecuredExposureInr: exposure.totalOpenUnsecuredExposureInr,
            maxOpenUnsecuredExposureInr: exposure.maxOpenUnsecuredExposureInr,
          };
        }
      } catch {
        // non-blocking — continue without credit limit if bounds/tier lookup fails
      }
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
          customer: { select: { mobileNumber: true } },
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

      const phoneCheck = this.checkBureauPhoneMatch(bureauRow.rawPayload, lead.customer?.mobileNumber ?? null);
      if (!phoneCheck.passed) {
        return {
          passed: false,
          rejectReason: phoneCheck.rejectReason,
          rejectionReasonCode: REJECTION_REASON.BUREAU_PHONE_MISMATCH,
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
      if (thresholds.cibilMinExisting != null && cibilScore < thresholds.cibilMinExisting) {
        return {
          passed: false,
          rejectReason: `CIBIL score ${cibilScore} is below minimum ${thresholds.cibilMinExisting} for existing customers.`,
          rejectionReasonCode: REJECTION_REASON.CIBIL_SCORE_LOW,
          cibilScore,
        };
      }
    } else if (thresholds.cibilMinNew != null && cibilScore < thresholds.cibilMinNew) {
      return {
        passed: false,
        rejectReason: `CIBIL score ${cibilScore} is below minimum ${thresholds.cibilMinNew} for new customers.`,
        rejectionReasonCode: REJECTION_REASON.CIBIL_SCORE_LOW,
        cibilScore,
      };
    }

    if (bureauRow?.rawPayload != null) {
      const bureauRules = this.runBureauPayloadRules(bureauRow.rawPayload, thresholds, isExistingCustomer);
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
    isExistingCustomer: boolean,
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

    if (thresholds.settledLookbackMonths != null) {
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

    if (thresholds.maxEnquiries30Days != null) {
      const enquiryCount = countBureauEnquiriesInLastDays(parsedReport, ENQUIRY_WINDOW_DAYS);
      if (enquiryCount > thresholds.maxEnquiries30Days) {
        return {
          passed: false,
          rejectReason: `Too many credit enquiries (${enquiryCount}) in the last ${ENQUIRY_WINDOW_DAYS} days (max ${thresholds.maxEnquiries30Days}).`,
          rejectionReasonCode: REJECTION_REASON.BUREAU_ENQUIRIES_EXCEEDED,
        };
      }
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

    if (thresholds.maxMissedPayments6Months != null) {
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
    }

    if (thresholds.minUnsecuredLoanAmount != null) {
      const exposure = computeOpenUnsecuredExposureBreakdown(rawPayload);
      const total = exposure.totalUnsecuredExposureInr;
      if (total < thresholds.minUnsecuredLoanAmount) {
        return {
          passed: false,
          rejectReason: `Total unsecured exposure ${total} INR is below minimum ${thresholds.minUnsecuredLoanAmount} INR.`,
          rejectionReasonCode: REJECTION_REASON.MIN_UNSECURED_LOAN_AMOUNT_FAILED,
        };
      }
    }

    const rejectedGrades = isExistingCustomer
      ? thresholds.rejectedCreditAssessmentGradesExisting
      : thresholds.rejectedCreditAssessmentGradesNew;
    if (rejectedGrades != null && rejectedGrades.length > 0) {
      const grade = this.resolveCreditAssessmentGrade(rawPayload, null);
      if (grade != null && rejectedGrades.includes(grade)) {
        const customerLabel = isExistingCustomer ? 'recurring' : 'new';
        const gradeList = rejectedGrades.join(', ');
        return {
          passed: false,
          rejectReason: `Credit assessment grade ${grade} is in the rejected set (${gradeList}) for ${customerLabel} customers.`,
          rejectionReasonCode: REJECTION_REASON.CREDIT_ASSESSMENT_GRADE_FAILED,
        };
      }
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

    // Bureau DOB vs customer DOB is not used for identity mismatch.
    // const leadDob = lead.leadDetail?.dateOfBirth;
    // const reportDobStr = reportData.dateOfBirth;
    // if (leadDob && reportDobStr) {
    //   const leadDobIso = leadDob.toISOString().slice(0, 10);
    //   if (leadDobIso !== reportDobStr) {
    //     return {
    //       passed: false,
    //       rejectReason: `Bureau DOB mismatch: entered ${leadDobIso} but bureau report contains ${reportDobStr}.`,
    //     };
    //   }
    // }

    return { passed: true, rejectReason: '' };
  }

  /**
   * Rejects when the bureau report lists phone number(s) and none match the applicant mobile.
   * Skipped (passes) when the report has no phone data or the applicant has no usable mobile —
   * same missing-data pattern as the PAN identity check.
   */
  private checkBureauPhoneMatch(
    rawPayload: unknown,
    applicantMobile: string | null,
  ): { passed: boolean; rejectReason: string; detail: string | null } {
    let reportData: ReturnType<typeof extractCibilReportData>;
    try {
      reportData = extractCibilReportData(rawPayload);
    } catch {
      return { passed: true, rejectReason: '', detail: 'Bureau payload could not be parsed for phones; skipped.' };
    }

    const normalizedApplicant = normalizePhoneForMatch(applicantMobile ?? '');
    if (!normalizedApplicant) {
      return { passed: true, rejectReason: '', detail: 'No usable applicant mobile; phone match skipped.' };
    }

    const reportNumbers = reportData.phones
      .map((p) => normalizePhoneForMatch(p.number))
      .filter((n): n is string => Boolean(n));
    if (reportNumbers.length === 0) {
      return { passed: true, rejectReason: '', detail: 'No phone numbers on bureau report; phone match skipped.' };
    }

    const reportedNumbers = [...new Set(reportData.phones.map((p) => p.number).filter(Boolean))].join(', ');

    if (reportNumbers.includes(normalizedApplicant)) {
      this.logger.log(
        `Bureau phone match: application mobile ${applicantMobile} found among bureau number(s) ${reportedNumbers}.`,
      );
      return {
        passed: true,
        rejectReason: '',
        detail: `Applicant mobile ${applicantMobile} matches bureau-reported number(s) ${reportedNumbers}.`,
      };
    }

    this.logger.warn(
      `Bureau phone mismatch: application mobile ${applicantMobile} not found among bureau number(s) ${reportedNumbers}.`,
    );
    return {
      passed: false,
      rejectReason: `Bureau phone mismatch: application mobile ${applicantMobile} does not match bureau-reported number(s) ${reportedNumbers}.`,
      detail: `Bureau phone mismatch: application mobile ${applicantMobile} does not match bureau-reported number(s) ${reportedNumbers}.`,
    };
  }

  private async findLatestBureauReportForLead(leadId: bigint): Promise<{
    cibilScore: number | null;
    rawPayload: unknown;
  } | null> {
    const row = await this.prisma.client.leadDetail.findUnique({
      where: { leadId },
      select: {
        bureauReport: {
          select: { cibilScore: true, rawPayload: true },
        },
      },
    });
    return row?.bureauReport ?? null;
  }

  private async loadPostBreRows(
    db: PrismaService['client'] = this.prisma.client,
  ): Promise<{ key: string; label: string; description: string | null; value: string }[]> {
    return db.eligibilityCriteria.findMany({
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
        case EC.NO_RESTRUCTURED_LOANS: return Boolean(thresholds.enforceNoRestructuredLoans);
        case EC.NO_SMA_PWOS: return Boolean(thresholds.enforceNoSmaPwos);
        case EC.NO_ACTIVE_MFI: return Boolean(thresholds.enforceNoActiveMfi);
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
    const pickInt = (key: string): number | null => {
      if (!map.has(key)) return null;
      const raw = map.get(key)?.trim();
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (!Number.isFinite(n)) throw new Error(`Missing or invalid eligibility_criteria: ${key}`);
      return n;
    };
    const FALSY = new Set(['false', '0', 'no']);
    const TRUTHY = new Set(['true', '1', 'yes']);
    const pickBool = (key: string): boolean | null => {
      if (!map.has(key)) return null;
      const raw = map.get(key)?.trim().toLowerCase();
      if (FALSY.has(raw!)) return false;
      if (TRUTHY.has(raw!)) return true;
      throw new Error(`Missing or invalid eligibility_criteria: ${key}`);
    };
    const pickGradeList = (key: string): string[] | null => {
      if (!map.has(key)) return null;
      const raw = map.get(key)?.trim() ?? '';
      return raw
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
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
      minUnsecuredLoanAmount: pickInt(EC.MIN_UNSECURED_LOAN_AMOUNT),
      rejectedCreditAssessmentGradesNew: pickGradeList(EC.REJECTED_CREDIT_ASSESSMENT_GRADES_NEW),
      rejectedCreditAssessmentGradesExisting: pickGradeList(EC.REJECTED_CREDIT_ASSESSMENT_GRADES_EXISTING),
    };
  }

  private resolveCreditAssessmentGrade(rawPayload: unknown, riskScore: number | null): string | null {
    try {
      const signals = computeCibilAssessmentSignals(rawPayload, riskScore);
      return assignCibilCategory(signals).category;
    } catch {
      return null;
    }
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

/** Strips non-digits and keeps the last 10 so `+91`/`0`-prefixed bureau numbers still compare equal. */
function normalizePhoneForMatch(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

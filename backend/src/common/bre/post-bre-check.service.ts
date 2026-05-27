import { Injectable, Logger } from '@nestjs/common';
import { APPLICATION_STATUS } from '../constants/application.constants';
import { REJECTION_REASON } from '../constants/rejection-reason.constants';
import {
  auditBureauEnquiriesInLastDays,
  auditNoActiveMfiLoans,
  auditNoAdverseTradelineInLookback,
  auditNoRestructuredLoans,
  auditNoSmaPwosTradelines,
  buildPostBreBureauSummary,
  buildPostBreEnquiryInspection,
  buildPostBreTradelineInspection,
  checkBureauDpdRules,
  checkNoActiveMfiLoans,
  checkNoAdverseTradelineInLookback,
  checkNoRestructuredLoans,
  checkNoSmaPwosTradelines,
  countBureauEnquiriesInLastDays,
  evaluateBureauDpdRulesDetailed,
  type BureauRuleFinding,
  type PostBreBureauSummary,
  type PostBreEnquiryInspectionRow,
  type PostBreTradelineInspectionRow,
} from '../cibil/cibil-bureau-rules.parser';
import { parseTenacioBureauVendorBody } from '../vendor/tenacio-bureau-payload.mapper';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildPostBreRulesCatalog,
  POST_BRE_ENQUIRY_WINDOW_DAYS,
  type PostBreRuleCatalogEntry,
  type PostBreRulesCatalog,
} from './post-bre-rules.catalog';

export type { PostBreRuleCatalogEntry, PostBreRulesCatalog };

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
};

/** Maps eligibility_criteria.key → post-BRE check id(s). */
const POST_BRE_CRITERIA_TO_CHECKS: Record<string, string[]> = {
  cibil_min_new: ['cibil_score_minimum'],
  cibil_min_existing: ['cibil_score_minimum'],
  settled_months: ['adverse_tradeline'],
  no_restructured_loans: ['no_restructured_loans'],
  no_sma_pwos: ['no_sma_pwos'],
  no_active_mfi: ['no_active_mfi'],
  max_enquiries_30_days: ['credit_enquiries'],
  open_dpd_months: ['dpd_open_dpd'],
  dpd_30plus_months: ['dpd_dpd_30plus'],
  dpd_60plus_months: ['dpd_dpd_60plus'],
  dpd_90plus_months: ['dpd_dpd_90plus'],
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

  constructor(private readonly prisma: PrismaService) {}

  /** Reference catalog for LOS developer tools (live thresholds + rule conditions). */
  async getRulesCatalog(): Promise<{
    enquiryWindowDays: number;
    thresholds: PostBreThresholds;
    criteria: PostBreCriteriaConfigRow[];
    rules: PostBreRuleCatalogEntry[];
  }> {
    const thresholds = await this.loadPostBreThresholds();
    const criteria = await this.loadPostBreCriteriaConfig(thresholds);
    const { rules, enquiryWindowDays } = buildPostBreRulesCatalog(thresholds);
    return { enquiryWindowDays, thresholds, criteria, rules };
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

    if (cibilScore === -1) {
      push({
        id: 'new_to_credit',
        label: 'New to credit (NTC)',
        passed: false,
        rejectionReasonCode: REJECTION_REASON.NEW_TO_CREDIT,
        detail: 'Bureau score is -1 (new to credit).',
        meta: { cibilScore },
        findings: [
          {
            title: 'NTC score',
            detail: 'CIBIL reports -1 when the borrower has no usable credit history.',
            data: { cibilScore: -1 },
          },
        ],
      });
    } else {
      push({
        id: 'new_to_credit',
        label: 'New to credit (NTC)',
        passed: true,
        rejectionReasonCode: null,
        detail: 'Score is not -1.',
        meta: { cibilScore },
      });
    }

    if (cibilScore !== null && cibilScore !== -1) {
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
        criteriaKeys: [input.isExistingCustomer ? 'cibil_min_existing' : 'cibil_min_new'],
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
                  criterionKey: input.isExistingCustomer ? 'cibil_min_existing' : 'cibil_min_new',
                },
              },
            ],
      });
    }

    const adverse = auditNoAdverseTradelineInLookback(
      input.rawPayload,
      thresholds.settledLookbackMonths,
    );
    push({
      id: 'adverse_tradeline',
      label: `No adverse tradeline / settlement (${thresholds.settledLookbackMonths} months)`,
      passed: adverse.passed,
      rejectionReasonCode: adverse.passed ? null : REJECTION_REASON.BUREAU_ADVERSE_TRADELINE,
      detail:
        adverse.detail ??
        (adverse.passed
          ? `No adverse tradeline signals in the last ${thresholds.settledLookbackMonths} months.`
          : `Adverse bureau tradeline status in the last ${thresholds.settledLookbackMonths} months.`),
      meta: { lookbackMonths: thresholds.settledLookbackMonths, hitCount: adverse.findings.length },
      criteriaKeys: ['settled_months'],
      findings: adverse.passed ? undefined : adverse.findings,
    });

    if (thresholds.enforceNoRestructuredLoans) {
      activeTradelineRuleIds.push('no_restructured_loans');
      const restructured = auditNoRestructuredLoans(input.rawPayload);
      push({
        id: 'no_restructured_loans',
        label: 'No restructured loans (TUEF Tag 33)',
        passed: restructured.passed,
        rejectionReasonCode: restructured.passed ? null : REJECTION_REASON.BUREAU_RESTRUCTURED_LOAN,
        detail: restructured.passed
          ? 'No restructured loan tradelines on bureau report.'
          : restructured.detail,
        meta: { hitCount: restructured.findings.length },
        criteriaKeys: ['no_restructured_loans'],
        findings: restructured.passed ? undefined : restructured.findings,
      });
    }

    if (thresholds.enforceNoSmaPwos) {
      activeTradelineRuleIds.push('no_sma_pwos');
      const smaPwos = auditNoSmaPwosTradelines(input.rawPayload);
      push({
        id: 'no_sma_pwos',
        label: 'No SMA or PWOS trade lines (TUEF asset class)',
        passed: smaPwos.passed,
        rejectionReasonCode: smaPwos.passed ? null : REJECTION_REASON.BUREAU_SMA_PWOS_TRADELINE,
        detail: smaPwos.passed
          ? 'No SMA / PWOS payment status on any tradeline.'
          : smaPwos.detail,
        meta: { hitCount: smaPwos.findings.length },
        criteriaKeys: ['no_sma_pwos'],
        findings: smaPwos.passed ? undefined : smaPwos.findings,
      });
    }

    if (thresholds.enforceNoActiveMfi) {
      activeTradelineRuleIds.push('no_active_mfi');
      const mfi = auditNoActiveMfiLoans(input.rawPayload);
      push({
        id: 'no_active_mfi',
        label: 'No active MFI loans (Appendix A types 40–43)',
        passed: mfi.passed,
        rejectionReasonCode: mfi.passed ? null : REJECTION_REASON.BUREAU_ACTIVE_MFI_LOAN,
        detail: mfi.passed ? 'No open microfinance loan tradelines.' : mfi.detail,
        meta: { hitCount: mfi.findings.length },
        criteriaKeys: ['no_active_mfi'],
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
      criteriaKeys: ['max_enquiries_30_days'],
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
      open_dpd: 'open_dpd_months',
      dpd_30plus: 'dpd_30plus_months',
      dpd_60plus: 'dpd_60plus_months',
      dpd_90plus: 'dpd_90plus_months',
    };

    for (const dpdRule of evaluateBureauDpdRulesDetailed(input.rawPayload, dpdThresholds)) {
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

    return {
      overallPassed,
      cibilScore,
      isExistingCustomer: input.isExistingCustomer,
      thresholds,
      checks,
      inspection,
    };
  }

  async run(input: PostBreCheckInput): Promise<PostBreCheckResult> {
    const bureauRow = await this.findLatestBureauReportForLead(input.leadId);
    const cibilScore = bureauRow?.cibilScore ?? null;

    if (cibilScore === null) {
      this.logger.warn(`Post-BRE skipped score rules (leadId=${input.leadId.toString()}): no bureau score on file.`);
      return { passed: true, rejectReason: null, rejectionReasonCode: null, cibilScore: null };
    }

    if (cibilScore === -1) {
      return {
        passed: false,
        rejectReason: 'New to credit: bureau score is -1 (NTC).',
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
    const adverse = checkNoAdverseTradelineInLookback(
      rawPayload,
      thresholds.settledLookbackMonths,
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

    const dpd = checkBureauDpdRules(rawPayload, {
      openDpdMonths: thresholds.openDpdMonths,
      dpd30PlusMonths: thresholds.dpd30PlusMonths,
      dpd60PlusMonths: thresholds.dpd60PlusMonths,
      dpd90PlusMonths: thresholds.dpd90PlusMonths,
    });
    if (!dpd.passed) {
      return {
        passed: false,
        rejectReason: dpd.detail ?? 'Bureau DPD rules failed.',
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
        case 'no_restructured_loans':
          return thresholds.enforceNoRestructuredLoans;
        case 'no_sma_pwos':
          return thresholds.enforceNoSmaPwos;
        case 'no_active_mfi':
          return thresholds.enforceNoActiveMfi;
        default:
          return true;
      }
    };

    const valueForKey = (key: string): string => {
      switch (key) {
        case 'cibil_min_new':
          return String(thresholds.cibilMinNew);
        case 'cibil_min_existing':
          return String(thresholds.cibilMinExisting);
        case 'settled_months':
          return String(thresholds.settledLookbackMonths);
        case 'max_enquiries_30_days':
          return String(thresholds.maxEnquiries30Days);
        case 'open_dpd_months':
          return String(thresholds.openDpdMonths);
        case 'dpd_30plus_months':
          return String(thresholds.dpd30PlusMonths);
        case 'dpd_60plus_months':
          return String(thresholds.dpd60PlusMonths);
        case 'dpd_90plus_months':
          return String(thresholds.dpd90PlusMonths);
        case 'no_restructured_loans':
          return thresholds.enforceNoRestructuredLoans ? 'true' : 'false';
        case 'no_sma_pwos':
          return thresholds.enforceNoSmaPwos ? 'true' : 'false';
        case 'no_active_mfi':
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
      'cibil_min_new',
      'cibil_min_existing',
      'settled_months',
      'max_enquiries_30_days',
      'open_dpd_months',
      'dpd_30plus_months',
      'dpd_60plus_months',
      'dpd_90plus_months',
      'no_restructured_loans',
      'no_sma_pwos',
      'no_active_mfi',
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
      cibilMinNew: pickInt('cibil_min_new', DEFAULT_CIBIL_MIN_NEW),
      cibilMinExisting: pickInt('cibil_min_existing', DEFAULT_CIBIL_MIN_EXISTING),
      settledLookbackMonths: pickInt('settled_months', DEFAULT_SETTLED_LOOKBACK_MONTHS),
      maxEnquiries30Days: pickInt('max_enquiries_30_days', DEFAULT_MAX_ENQUIRIES_30_DAYS),
      openDpdMonths: pickInt('open_dpd_months', DEFAULT_OPEN_DPD_MONTHS),
      dpd30PlusMonths: pickInt('dpd_30plus_months', DEFAULT_DPD_30PLUS_MONTHS),
      dpd60PlusMonths: pickInt('dpd_60plus_months', DEFAULT_DPD_60PLUS_MONTHS),
      dpd90PlusMonths: pickInt('dpd_90plus_months', DEFAULT_DPD_90PLUS_MONTHS),
      enforceNoRestructuredLoans: pickBool('no_restructured_loans', true),
      enforceNoSmaPwos: pickBool('no_sma_pwos', true),
      enforceNoActiveMfi: pickBool('no_active_mfi', true),
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

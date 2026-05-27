import { Injectable, Logger } from '@nestjs/common';
import { APPLICATION_STATUS } from '../constants/application.constants';
import { REJECTION_REASON } from '../constants/rejection-reason.constants';
import {
  checkBureauDpdRules,
  checkNoAdverseTradelineInLookback,
  countBureauEnquiriesInLastDays,
} from '../cibil/cibil-bureau-rules.parser';
import { PrismaService } from '../../prisma/prisma.service';

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

const DEFAULT_CIBIL_MIN_NEW = 700;
const DEFAULT_CIBIL_MIN_EXISTING = 650;
const DEFAULT_SETTLED_LOOKBACK_MONTHS = 18;
const DEFAULT_MAX_ENQUIRIES_30_DAYS = 10;
const DEFAULT_OPEN_DPD_MONTHS = 6;
const DEFAULT_DPD_30PLUS_MONTHS = 3;
const DEFAULT_DPD_60PLUS_MONTHS = 9;
const DEFAULT_DPD_90PLUS_MONTHS = 12;
const ENQUIRY_WINDOW_DAYS = 30;

/**
 * Rules applied after a successful bureau pull (Tenacio soft-pull, etc.).
 */
@Injectable()
export class PostBreCheckService {
  private readonly logger = new Logger(PostBreCheckService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    return {
      cibilMinNew: pickInt('cibil_min_new', DEFAULT_CIBIL_MIN_NEW),
      cibilMinExisting: pickInt('cibil_min_existing', DEFAULT_CIBIL_MIN_EXISTING),
      settledLookbackMonths: pickInt('settled_months', DEFAULT_SETTLED_LOOKBACK_MONTHS),
      maxEnquiries30Days: pickInt('max_enquiries_30_days', DEFAULT_MAX_ENQUIRIES_30_DAYS),
      openDpdMonths: pickInt('open_dpd_months', DEFAULT_OPEN_DPD_MONTHS),
      dpd30PlusMonths: pickInt('dpd_30plus_months', DEFAULT_DPD_30PLUS_MONTHS),
      dpd60PlusMonths: pickInt('dpd_60plus_months', DEFAULT_DPD_60PLUS_MONTHS),
      dpd90PlusMonths: pickInt('dpd_90plus_months', DEFAULT_DPD_90PLUS_MONTHS),
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

type PostBreThresholds = {
  cibilMinNew: number;
  cibilMinExisting: number;
  settledLookbackMonths: number;
  maxEnquiries30Days: number;
  openDpdMonths: number;
  dpd30PlusMonths: number;
  dpd60PlusMonths: number;
  dpd90PlusMonths: number;
};

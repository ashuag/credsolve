import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { computeOpenUnsecuredExposureBreakdown } from '../../../../common/cibil/cibil-tradeline.parser';
import { CreditLimitTierResolverService } from '../../../../common/cibil/credit-limit-tier-resolver.service';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { isCibilNewToCreditScore } from '../../../../common/vendor/tenacio-bureau-payload.mapper';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { BureauReportRepository } from '../../infrastructure/repositories/bureau-report.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';

const LOAN_OFFER_UNAVAILABLE_MESSAGE =
  'We are unable to offer a loan based on your current credit profile.';

export type LoanEligibilityResult = {
  /** Pre-approved offer ceiling in whole INR (from bureau tier). */
  preApprovedAmountInr: number;
  /** Bounds from `MIN_LOAN_AMOUNT` / `MAX_LOAN_AMOUNT` settings (same as `GET /loans/settings`). */
  minLoanAmountInr: number;
  maxLoanAmountInr: number;
};

@Injectable()
export class CheckLoanEligibilityUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly settings: SettingsRepository,
    private readonly bureauReports: BureauReportRepository,
    private readonly creditLimitTiers: CreditLimitTierResolverService,
  ) {}

  /**
   * Pre-approved ceiling from the latest bureau pull: total unsecured tradeline exposure
   * (open + closed) → `credit_limit_tier.max_bullet_loan`, clamped to product min/max loan settings.
   */
  async computeForLead(leadId: bigint): Promise<LoanEligibilityResult> {
    await this.assertLeadEligibleForOffer(leadId);

    const bounds = await this.loadLoanBounds();
    const rawPayload = await this.bureauReports.findLatestRawPayloadForLead(leadId);
    if (rawPayload == null) {
      throw new ForbiddenException(LOAN_OFFER_UNAVAILABLE_MESSAGE);
    }

    const { totalUnsecuredExposureInr } = computeOpenUnsecuredExposureBreakdown(rawPayload);
    const tier = await this.creditLimitTiers.resolveMaxBulletLoan(totalUnsecuredExposureInr);
    if (!tier) {
      throw new ForbiddenException(LOAN_OFFER_UNAVAILABLE_MESSAGE);
    }

    return {
      preApprovedAmountInr: this.clampToBounds(tier.maxBulletLoan, bounds),
      minLoanAmountInr: bounds.minInr,
      maxLoanAmountInr: bounds.maxInr,
    };
  }

  /**
   * Resolves the signed-in customer’s active lead and derives the pre-approved ceiling.
   */
  async executeForCustomerSession(req: Request): Promise<LoanEligibilityResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const lead = await this.leads.findActiveSummaryForCustomer(customer.id);
    if (!lead) {
      throw new NotFoundException('No active lead found.');
    }

    return this.computeForLead(lead.id);
  }

  private async loadLoanBounds(): Promise<{ minInr: number; maxInr: number }> {
    const { minLoanAmount, maxLoanAmount } = await this.settings.loadLoanCalculationSettings();
    const minInr = Math.max(1, Math.floor(minLoanAmount));
    const maxInr = Math.max(minInr, Math.floor(maxLoanAmount));
    return { minInr, maxInr };
  }

  private clampToBounds(amountInr: number, bounds: { minInr: number; maxInr: number }): number {
    const n = Math.floor(amountInr);
    return Math.min(bounds.maxInr, Math.max(bounds.minInr, n));
  }

  /** Blocks pre-approved amounts for rejected leads, failed post-BRE, and new-to-credit bureau scores. */
  private async assertLeadEligibleForOffer(leadId: bigint): Promise<void> {
    const row = (await this.leads.findUniqueLead({
      where: { id: leadId },
      select: {
        leadStatus: { select: { name: true } },
        applications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            applicationStatus: { select: { name: true } },
          },
        },
      },
    })) as {
      leadStatus: { name: string } | null;
      applications: Array<{ applicationStatus: { name: string } }>;
    } | null;

    if (!row) {
      throw new ForbiddenException(LOAN_OFFER_UNAVAILABLE_MESSAGE);
    }

    const statusName = row.leadStatus?.name;
    if (statusName === LEAD_STATUS.REJECTED || statusName === LEAD_STATUS.BLACKLISTED) {
      throw new ForbiddenException(LOAN_OFFER_UNAVAILABLE_MESSAGE);
    }

    const latestApplication = row.applications[0];
    if (latestApplication?.applicationStatus.name === APPLICATION_STATUS.REJECTED) {
      throw new ForbiddenException(LOAN_OFFER_UNAVAILABLE_MESSAGE);
    }

    const cibilScore = await this.bureauReports.findLatestBureauScoreForLead(leadId);
    if (isCibilNewToCreditScore(cibilScore)) {
      throw new ForbiddenException(LOAN_OFFER_UNAVAILABLE_MESSAGE);
    }
  }
}

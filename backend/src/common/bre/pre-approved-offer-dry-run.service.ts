import { Injectable } from '@nestjs/common';
import {
  computeOpenUnsecuredExposureBreakdown,
  type OpenUnsecuredTradelineRow,
} from '../cibil/cibil-tradeline.parser';
import { CreditLimitTierResolverService } from '../cibil/credit-limit-tier-resolver.service';
import { parseTenacioBureauVendorBody } from '../vendor/tenacio-bureau-payload.mapper';
import { PrismaService } from '../../prisma/prisma.service';
import { loadLoanAmountBounds } from './bre-settings.loader';

export type PreApprovedOfferDryRunResult = {
  cibilScore: number | null;
  maxOpenUnsecuredExposureInr: number;
  totalOpenUnsecuredExposureInr: number;
  totalUnsecuredExposureInr: number;
  openUnsecuredTradelines: OpenUnsecuredTradelineRow[];
  tier: {
    tierId: number;
    minUnsecuredLoan: number;
    maxUnsecuredLoan: number | null;
    maxBulletLoan: number;
  } | null;
  preApprovedAmountInr: number | null;
  minLoanAmountInr: number;
  maxLoanAmountInr: number;
  detail: string;
};

@Injectable()
export class PreApprovedOfferDryRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditLimitTiers: CreditLimitTierResolverService,
  ) {}

  async evaluateFromBureauPayload(rawPayload: unknown): Promise<PreApprovedOfferDryRunResult> {
    const parsed = parseTenacioBureauVendorBody(rawPayload);
    const bounds = await loadLoanAmountBounds(this.prisma);
    const exposure = computeOpenUnsecuredExposureBreakdown(rawPayload);
    const totalUnsecuredExposureInr = exposure.totalUnsecuredExposureInr;
    const maxOpenUnsecuredExposureInr = exposure.maxOpenUnsecuredExposureInr;
    const resolved = await this.creditLimitTiers.resolveMaxBulletLoan(totalUnsecuredExposureInr);

    if (!resolved) {
      return {
        cibilScore: parsed.bureauScore,
        maxOpenUnsecuredExposureInr,
        totalOpenUnsecuredExposureInr: exposure.totalOpenUnsecuredExposureInr,
        totalUnsecuredExposureInr,
        openUnsecuredTradelines: exposure.lines,
        tier: null,
        preApprovedAmountInr: null,
        minLoanAmountInr: bounds.minLoanAmountInr,
        maxLoanAmountInr: bounds.maxLoanAmountInr,
        detail:
          'No active credit-limit tier matches total unsecured exposure. Check Credit Limit Eligibility tiers in Configuration.',
      };
    }

    const tierRow = await this.prisma.client.creditLimitTier.findUnique({
      where: { id: resolved.tierId },
      select: {
        id: true,
        minUnsecuredLoan: true,
        maxUnsecuredLoan: true,
        maxBulletLoan: true,
      },
    });

    const preApprovedAmountInr = this.clampToBounds(resolved.maxBulletLoan, bounds);

    return {
      cibilScore: parsed.bureauScore,
      maxOpenUnsecuredExposureInr,
      totalOpenUnsecuredExposureInr: exposure.totalOpenUnsecuredExposureInr,
      totalUnsecuredExposureInr,
      openUnsecuredTradelines: exposure.lines,
      tier: tierRow
        ? {
            tierId: tierRow.id,
            minUnsecuredLoan: tierRow.minUnsecuredLoan,
            maxUnsecuredLoan: tierRow.maxUnsecuredLoan,
            maxBulletLoan: tierRow.maxBulletLoan,
          }
        : {
            tierId: resolved.tierId,
            minUnsecuredLoan: 0,
            maxUnsecuredLoan: null,
            maxBulletLoan: resolved.maxBulletLoan,
          },
      preApprovedAmountInr,
      minLoanAmountInr: bounds.minLoanAmountInr,
      maxLoanAmountInr: bounds.maxLoanAmountInr,
      detail: `Tier #${resolved.tierId}: max bullet loan Rs. ${resolved.maxBulletLoan.toLocaleString('en-IN')} (clamped to product min/max).`,
    };
  }

  private clampToBounds(
    amountInr: number,
    bounds: { minLoanAmountInr: number; maxLoanAmountInr: number },
  ): number {
    const n = Math.floor(amountInr);
    return Math.min(bounds.maxLoanAmountInr, Math.max(bounds.minLoanAmountInr, n));
  }
}

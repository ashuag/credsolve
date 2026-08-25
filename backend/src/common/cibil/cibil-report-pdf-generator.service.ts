import { Injectable } from '@nestjs/common';
import { loadLoanAmountBounds } from '../bre/bre-settings.loader';
import { buildCibilStyleReportPdf } from './cibil-report-pdf-builder';
import {
  extractCibilReportData,
  type CibilReportData,
  type CibilReportPreApprovedInsight,
} from './cibil-report-data.extractor';
import { computeMaxOpenUnsecuredExposureInr } from './cibil-tradeline.parser';
import { CreditLimitTierResolverService } from './credit-limit-tier-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CibilReportPdfGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditLimitTiers: CreditLimitTierResolverService,
  ) {}

  /** Structured bureau view (score, tradelines, enquiries, pre-approved tier) for LOS UI. */
  async buildEnrichedReportData(vendorBody: unknown): Promise<CibilReportData> {
    const data = extractCibilReportData(vendorBody);
    // const preApprovedInsight = await this.resolvePreApprovedInsight(vendorBody);
    // return { ...data, preApprovedInsight };
    return data;
  }

  async generatePdf(vendorBody: unknown): Promise<Uint8Array> {
    const enriched = await this.buildEnrichedReportData(vendorBody);
    return buildCibilStyleReportPdf(enriched);
  }

  // private async resolvePreApprovedInsight(
  //   vendorBody: unknown,
  // ): Promise<CibilReportPreApprovedInsight | null> {
  //   const bounds = await loadLoanAmountBounds(this.prisma);
  //   const maxExposure = computeMaxOpenUnsecuredExposureInr(vendorBody);
  //   const resolved = await this.creditLimitTiers.resolveMaxBulletLoan(maxExposure);

  //   if (!resolved) {
  //     return {
  //       tierId: null,
  //       tierBandLabel: null,
  //       maxBulletLoan: null,
  //       preApprovedAmountInr: null,
  //       minLoanAmountInr: bounds.minLoanAmountInr,
  //       maxLoanAmountInr: bounds.maxLoanAmountInr,
  //       detail:
  //         maxExposure > 0
  //           ? `Max open unsecured exposure ${this.formatInr(maxExposure)} — no active credit-limit tier matches.`
  //           : 'No open unsecured tradelines with exposure found for tier lookup.',
  //     };
  //   }

  //   const tierRow = await this.prisma.client.creditLimitTier.findUnique({
  //     where: { id: resolved.tierId },
  //     select: { minUnsecuredLoan: true, maxUnsecuredLoan: true },
  //   });

  //   const bandLabel = tierRow
  //     ? `${this.formatInr(tierRow.minUnsecuredLoan)} – ${
  //         tierRow.maxUnsecuredLoan != null ? this.formatInr(tierRow.maxUnsecuredLoan) : 'no max'
  //       }`
  //     : null;

  //   const preApprovedAmountInr = this.clampToBounds(resolved.maxBulletLoan, bounds);

  //   return {
  //     tierId: resolved.tierId,
  //     tierBandLabel: bandLabel,
  //     maxBulletLoan: resolved.maxBulletLoan,
  //     preApprovedAmountInr,
  //     minLoanAmountInr: bounds.minLoanAmountInr,
  //     maxLoanAmountInr: bounds.maxLoanAmountInr,
  //     detail: `Tier #${resolved.tierId}: max bullet loan ${this.formatInr(resolved.maxBulletLoan)} (product bounds applied).`,
  //   };
  // }

  // private clampToBounds(
  //   amountInr: number,
  //   bounds: { minLoanAmountInr: number; maxLoanAmountInr: number },
  // ): number {
  //   const n = Math.floor(amountInr);
  //   return Math.min(bounds.maxLoanAmountInr, Math.max(bounds.minLoanAmountInr, n));
  // }

  // private formatInr(n: number): string {
  //   return `Rs. ${Math.floor(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  // }
}

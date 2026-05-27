import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ResolvedCreditLimitTier = {
  tierId: number;
  maxBulletLoan: number;
  maxOpenUnsecuredExposureInr: number;
};

@Injectable()
export class CreditLimitTierResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pick the active tier whose unsecured band contains `maxOpenUnsecuredExposureInr`.
   * Tiers are ordered by `sortOrder` ascending; first match wins.
   */
  async resolveMaxBulletLoan(maxOpenUnsecuredExposureInr: number): Promise<ResolvedCreditLimitTier | null> {
    const exposure = Math.max(0, Math.floor(maxOpenUnsecuredExposureInr));
    const tiers = await this.prisma.client.creditLimitTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        minUnsecuredLoan: true,
        maxUnsecuredLoan: true,
        maxBulletLoan: true,
      },
    });

    for (const tier of tiers) {
      if (exposure < tier.minUnsecuredLoan) continue;
      if (tier.maxUnsecuredLoan != null && exposure > tier.maxUnsecuredLoan) continue;
      return {
        tierId: tier.id,
        maxBulletLoan: tier.maxBulletLoan,
        maxOpenUnsecuredExposureInr: exposure,
      };
    }

    return null;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { type DatabaseSession } from '../../../../prisma/database-session';

export type CreditLimitTierRow = {
  id: number;
  minUnsecuredLoan: number;
  maxUnsecuredLoan: number | null;
  maxBulletLoan: number;
  sortOrder: number;
  isActive: boolean;
};

@Injectable()
export class CreditLimitTierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(session?: DatabaseSession): Promise<CreditLimitTierRow[]> {
    const client = session?.tx ?? this.prisma;
    return client.creditLimitTier.findMany({
      select: { id: true, minUnsecuredLoan: true, maxUnsecuredLoan: true, maxBulletLoan: true, sortOrder: true, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Returns the matching tier for a given unsecured credit limit, or undefined if below all tiers. */
  async findTierForLimit(
    unsecuredLimit: number,
    session?: DatabaseSession,
  ): Promise<CreditLimitTierRow | undefined> {
    const client = session?.tx ?? this.prisma;

    // Find the highest-ranked tier whose min is ≤ unsecuredLimit and whose max is either null or ≥ unsecuredLimit.
    const tier = await client.creditLimitTier.findFirst({
      where: {
        isActive: true,
        minUnsecuredLoan: { lte: unsecuredLimit },
        OR: [
          { maxUnsecuredLoan: null },
          { maxUnsecuredLoan: { gte: unsecuredLimit } },
        ],
      },
      select: { id: true, minUnsecuredLoan: true, maxUnsecuredLoan: true, maxBulletLoan: true, sortOrder: true, isActive: true },
      orderBy: { sortOrder: 'desc' }, // highest matching tier wins
    });

    return tier ?? undefined;
  }

  async updateById(
    id: number,
    data: { minUnsecuredLoan?: number; maxUnsecuredLoan?: number | null; maxBulletLoan?: number; sortOrder?: number; isActive?: boolean },
    session?: DatabaseSession,
  ): Promise<CreditLimitTierRow> {
    const client = session?.tx ?? this.prisma;
    return client.creditLimitTier.update({
      where: { id },
      data,
      select: { id: true, minUnsecuredLoan: true, maxUnsecuredLoan: true, maxBulletLoan: true, sortOrder: true, isActive: true },
    });
  }
}

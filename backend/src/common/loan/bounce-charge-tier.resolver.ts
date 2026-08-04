import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  resolveBounceFeeInr,
  type BounceChargeTierRow,
} from './bounce-charge.util';

/** Fallback schedule matching seed / sanction-letter grid when table or client is unavailable. */
const DEFAULT_BOUNCE_TIERS: BounceChargeTierRow[] = [
  { minAmountInr: 0, maxAmountInr: 2_000, bounceFeeInr: 100, sortOrder: 1, isActive: true },
  { minAmountInr: 2_001, maxAmountInr: 5_000, bounceFeeInr: 200, sortOrder: 2, isActive: true },
  { minAmountInr: 5_001, maxAmountInr: 8_000, bounceFeeInr: 300, sortOrder: 3, isActive: true },
  { minAmountInr: 8_001, maxAmountInr: 10_000, bounceFeeInr: 400, sortOrder: 4, isActive: true },
  { minAmountInr: 10_001, maxAmountInr: null, bounceFeeInr: 500, sortOrder: 5, isActive: true },
];

@Injectable()
export class BounceChargeTierResolverService {
  private readonly logger = new Logger(BounceChargeTierResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listActiveTiers(): Promise<BounceChargeTierRow[]> {
    const delegate = (this.prisma.client as { bounceChargeTier?: { findMany: Function } })
      .bounceChargeTier;
    if (!delegate?.findMany) {
      this.logger.warn(
        'Prisma client missing bounceChargeTier — run `prisma migrate deploy` and `prisma generate`. Using default schedule.',
      );
      return DEFAULT_BOUNCE_TIERS;
    }

    try {
      const rows = await delegate.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          minAmountInr: true,
          maxAmountInr: true,
          bounceFeeInr: true,
          sortOrder: true,
          isActive: true,
        },
      });
      return rows.length > 0 ? (rows as BounceChargeTierRow[]) : DEFAULT_BOUNCE_TIERS;
    } catch (error) {
      this.logger.warn(
        `Failed to load bounce_charge_tier rows; using default schedule. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return DEFAULT_BOUNCE_TIERS;
    }
  }

  /** Bounce fee for `amountInr` from the active schedule (0 when no matching tier). */
  async resolveFeeForAmount(amountInr: number): Promise<number> {
    const tiers = await this.listActiveTiers();
    return resolveBounceFeeInr(amountInr, tiers);
  }
}

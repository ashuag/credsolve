import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingKey } from '../constants/setting.constants';
import {
  computePenalChargeInr,
  DEFAULT_PENAL_CHARGE_CONFIG,
  type BounceChargeTierRow,
  type PenalChargeConfig,
} from './bounce-charge.util';

/** Active bounce schedule plus the penal parameters that bound it. */
export type BounceChargeContext = {
  tiers: BounceChargeTierRow[];
  penal: PenalChargeConfig;
};

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

  /** Penal parameters from the `setting` table, falling back per-key when a row is missing. */
  async loadPenalConfig(): Promise<PenalChargeConfig> {
    const keys = [
      SettingKey.PENAL_RATE_PERCENT.key,
      SettingKey.PENAL_MIN_INR.key,
      SettingKey.PENAL_MAX_INR.key,
    ] as const;

    let rows: Array<{ key: string; value: string }> = [];
    try {
      rows = await this.prisma.client.setting.findMany({
        where: { key: { in: [...keys] }, isActive: true },
        select: { key: true, value: true },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to load PENAL_* settings; using defaults. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return DEFAULT_PENAL_CHARGE_CONFIG;
    }

    const pick = (key: string, fallback: number): number => {
      const raw = rows.find((r) => r.key === key)?.value;
      const parsed = raw != null ? Number.parseFloat(raw) : Number.NaN;
      // A blank or non-numeric row must not silently zero out a charge parameter.
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };

    return {
      ratePercent: pick(SettingKey.PENAL_RATE_PERCENT.key, DEFAULT_PENAL_CHARGE_CONFIG.ratePercent),
      minInr: pick(SettingKey.PENAL_MIN_INR.key, DEFAULT_PENAL_CHARGE_CONFIG.minInr),
      maxInr: pick(SettingKey.PENAL_MAX_INR.key, DEFAULT_PENAL_CHARGE_CONFIG.maxInr),
    };
  }

  /** Schedule and penal parameters in one round trip, for callers resolving many loans. */
  async loadContext(): Promise<BounceChargeContext> {
    const [tiers, penal] = await Promise.all([this.listActiveTiers(), this.loadPenalConfig()]);
    return { tiers, penal };
  }

  /** Penal charge when `overdueDays` > 0: rate % of principal, clamped between min and max. */
  async resolveChargeForAmount(amountInr: number, overdueDays: number): Promise<number> {
    const penal = await this.loadPenalConfig();
    return computePenalChargeInr(amountInr, overdueDays, penal);
  }
}

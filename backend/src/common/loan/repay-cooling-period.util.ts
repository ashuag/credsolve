import type { PrismaClient } from '@prisma/client';
import { SettingKey } from '../constants/setting.constants';

const META = SettingKey.REPAY_COOLING_PERIOD;
const FALLBACK = Number.parseInt(META.default, 10);

/**
 * Inclusive days from disbursement during which repayment charges interest only
 * for days used. `0` means no concession (always full contracted tenure).
 */
export function parseRepayCoolingPeriodDays(raw: string | null | undefined): number {
  const n = raw != null ? Number.parseInt(raw.trim(), 10) : NaN;
  if (!Number.isFinite(n) || n < 0) return FALLBACK;
  return Math.min(365, Math.floor(n));
}

export async function loadRepayCoolingPeriodDays(
  client: Pick<PrismaClient, 'setting'>,
): Promise<number> {
  const row = await client.setting.findFirst({
    where: { key: META.key, isActive: true },
    select: { value: true },
  });
  return parseRepayCoolingPeriodDays(row?.value ?? META.default);
}

import type { PrismaClient } from '@prisma/client';
import { SettingKey } from '../constants/setting.constants';

const META = SettingKey.MIN_PAY_AMOUNT;
const FALLBACK = Number.parseFloat(META.default);

function roundInr2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Minimum partial repayment in INR. `0` allows any positive amount. Invalid values use the default. */
export function parseMinPayAmountInr(raw: string | null | undefined): number {
  const n = raw != null ? Number.parseFloat(raw.trim()) : NaN;
  if (!Number.isFinite(n) || n < 0) return FALLBACK;
  return roundInr2(n);
}

export async function loadMinPayAmountInr(
  client: Pick<PrismaClient, 'setting'>,
): Promise<number> {
  const row = await client.setting.findFirst({
    where: { key: META.key, isActive: true },
    select: { value: true },
  });
  return parseMinPayAmountInr(row?.value ?? META.default);
}

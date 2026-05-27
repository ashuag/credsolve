import { SettingKey } from '../constants/setting.constants';
import type { BreSettings } from '../../modules/auth/infrastructure/repositories/settings.repository';
import { PrismaService } from '../../prisma/prisma.service';

function breMeta(key: keyof typeof SettingKey): (typeof SettingKey)[typeof key] {
  return SettingKey[key];
}

export async function loadBreSettings(prisma: PrismaService): Promise<BreSettings> {
  const keys = [
    breMeta('BRE_MIN_AGE').key,
    breMeta('BRE_MAX_AGE').key,
    breMeta('BRE_REJECTED_GENDERS').key,
    breMeta('BRE_REJECTED_OCCUPATIONS').key,
  ] as const;

  const rows = await prisma.client.setting.findMany({
    where: { key: { in: [...keys] }, isActive: true },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const pick = (key: string, def: string) => map.get(key)?.trim() || def;

  const parseIdList = (raw: string): number[] =>
    raw
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));

  return {
    minAge: Math.max(1, parseInt(pick(breMeta('BRE_MIN_AGE').key, breMeta('BRE_MIN_AGE').default), 10) || 21),
    maxAge: Math.max(1, parseInt(pick(breMeta('BRE_MAX_AGE').key, breMeta('BRE_MAX_AGE').default), 10) || 57),
    rejectedGenderIds: parseIdList(
      pick(breMeta('BRE_REJECTED_GENDERS').key, breMeta('BRE_REJECTED_GENDERS').default),
    ),
    rejectedOccupationIds: parseIdList(
      pick(breMeta('BRE_REJECTED_OCCUPATIONS').key, breMeta('BRE_REJECTED_OCCUPATIONS').default),
    ),
  };
}

export async function loadLoanAmountBounds(
  prisma: PrismaService,
): Promise<{ minLoanAmountInr: number; maxLoanAmountInr: number }> {
  const keys = [SettingKey.MIN_LOAN_AMOUNT.key, SettingKey.MAX_LOAN_AMOUNT.key] as const;
  const rows = await prisma.client.setting.findMany({
    where: { key: { in: [...keys] }, isActive: true },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const pick = (key: string, fallback: number) => {
    const raw = map.get(key)?.trim();
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  const minInr = Math.max(1, pick(SettingKey.MIN_LOAN_AMOUNT.key, 500));
  const maxInr = Math.max(minInr, pick(SettingKey.MAX_LOAN_AMOUNT.key, 30_000));
  return { minLoanAmountInr: minInr, maxLoanAmountInr: maxInr };
}

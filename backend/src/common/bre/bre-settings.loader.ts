import { ELIGIBILITY_CRITERIA as EC } from '../constants/eligibility-criteria.constants';
import { SettingKey } from '../constants/setting.constants';
import type { BreSettings } from '../../modules/auth/infrastructure/repositories/settings.repository';
import { PrismaService } from '../../prisma/prisma.service';

export async function loadBreSettings(prisma: Pick<PrismaService, 'client'>): Promise<BreSettings> {
  const criteriaKeys = [EC.MIN_AGE, EC.MAX_AGE, EC.REJECTED_GENDERS, EC.REJECTED_OCCUPATIONS];

  const criteriaRows = await prisma.client.eligibilityCriteria.findMany({
    where: { key: { in: criteriaKeys }, isActive: true },
    select: { key: true, value: true },
  });
  const cm = new Map(criteriaRows.map((r) => [r.key, r.value]));
  const pickCriteria = (key: string, def: string) => cm.get(key)?.trim() || def;
  const parseKeyList = (raw: string): string[] =>
    raw.split(',').map((s) => s.trim()).filter(Boolean);

  const minAge = Math.max(1, Number.parseInt(pickCriteria(EC.MIN_AGE, '21'), 10) || 21);
  const maxAge = Math.max(1, Number.parseInt(pickCriteria(EC.MAX_AGE, '58'), 10) || 58);
  const rejectedGenderKeys = parseKeyList(pickCriteria(EC.REJECTED_GENDERS, 'OTHERS'));
  const rejectedOccupationKeys = parseKeyList(pickCriteria(EC.REJECTED_OCCUPATIONS, 'STUDENT,HOMEMAKER,RETIRED'));

  const [genderRows, occupationRows] = await Promise.all([
    rejectedGenderKeys.length > 0
      ? prisma.client.gender.findMany({
          where: { key: { in: rejectedGenderKeys }, isActive: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    rejectedOccupationKeys.length > 0
      ? prisma.client.occupation.findMany({
          where: { key: { in: rejectedOccupationKeys }, isActive: true },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    minAge,
    maxAge,
    rejectedGenderIds: genderRows.map((r) => r.id),
    rejectedOccupationIds: occupationRows.map((r) => r.id),
  };
}

export async function loadLoanAmountBounds(
  prisma: Pick<PrismaService, 'client'>,
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

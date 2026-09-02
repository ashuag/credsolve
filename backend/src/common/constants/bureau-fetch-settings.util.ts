import type { PrismaClient } from '@prisma/client';
import { SettingKey } from './setting.constants';

/** `BUREAU_FETCH_ENABLED`: 0 = off, 1 = live Tenacio, 2 = mock (no HTTP). */
export type BureauFetchMode = 0 | 1 | 2;

const DAYS_META = SettingKey.BUREAU_FETCH_DAYS_LIMIT;
const DAYS_FALLBACK = Number.parseInt(DAYS_META.default, 10);

function parseBool(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'yes' || t === 'on';
}

export async function readBureauFetchMode(client: PrismaClient): Promise<BureauFetchMode> {
  const meta = SettingKey.BUREAU_FETCH_ENABLED;
  const row = await client.setting.findFirst({
    where: { key: meta.key, isActive: true },
    select: { value: true },
  });
  const raw = (row?.value?.trim() ?? meta.default).trim();

  const asInt = Number.parseInt(raw, 10);
  if (asInt === 2) return 2;
  if (asInt === 0) return 0;
  if (asInt === 1) return 1;
  if (Number.isFinite(asInt)) return 0;

  const t = raw.toLowerCase();
  if (t === '2') return 2;
  if (t === 'false' || t === 'no' || t === 'off' || t === '0') return 0;
  if (parseBool(raw)) return 1;
  return 0;
}

/** Recurring-customer reuse window. Invalid values fall back to the default (7). `0` = always fetch. */
export function parseBureauFetchDaysLimit(raw: string | null | undefined): number {
  const n = raw != null ? Number.parseInt(raw.trim(), 10) : NaN;
  if (!Number.isFinite(n) || n < 0) return DAYS_FALLBACK;
  return Math.min(365, Math.floor(n));
}

export async function readBureauFetchDaysLimit(
  client: Pick<PrismaClient, 'setting'>,
): Promise<number> {
  const row = await client.setting.findFirst({
    where: { key: DAYS_META.key, isActive: true },
    select: { value: true },
  });
  return parseBureauFetchDaysLimit(row?.value ?? DAYS_META.default);
}

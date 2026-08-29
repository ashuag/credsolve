import type { RedisService } from '../redis/redis.service';

const PENDING_TTL_SEC = 48 * 60 * 60; // 48h — covers abandoned checkouts

export type PendingRepayIntent = {
  loanAccountId: string;
  loanAccountUuid: string;
  applicationUuid: string;
  loanNumber: string;
  amountInr: string;
  bounceFeeInr: string;
  createdAt: string;
};

const LOAN_TXNIDS_TTL_SEC = 30 * 24 * 60 * 60; // 30d — longer than intent so LOS can still find txnids

export function repayIntentRedisKey(txnid: string): string {
  return `customer:repay-intent:${txnid.trim()}`;
}

export function repayIntentLoanRedisKey(loanAccountUuid: string): string {
  return `customer:repay-intents-by-loan:${loanAccountUuid.trim()}`;
}

export async function savePendingRepayIntent(
  redis: RedisService,
  txnid: string,
  intent: PendingRepayIntent,
): Promise<void> {
  await redis.client.set(
    repayIntentRedisKey(txnid),
    JSON.stringify(intent),
    'EX',
    PENDING_TTL_SEC,
  );
}

export async function loadPendingRepayIntent(
  redis: RedisService,
  txnid: string,
): Promise<PendingRepayIntent | null> {
  const raw = await redis.client.get(repayIntentRedisKey(txnid));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingRepayIntent;
    if (
      !parsed?.loanAccountUuid ||
      !parsed?.applicationUuid ||
      !parsed?.loanNumber ||
      !parsed?.amountInr ||
      !parsed?.loanAccountId
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingRepayIntent(redis: RedisService, txnid: string): Promise<void> {
  try {
    await redis.client.del(repayIntentRedisKey(txnid));
  } catch {
    // best-effort
  }
}

/** Index initiated txnids by loan so LOS can reconcile after a missed callback. */
export async function rememberLoanRepayTxnid(
  redis: RedisService,
  loanAccountUuid: string,
  txnid: string,
): Promise<void> {
  const key = repayIntentLoanRedisKey(loanAccountUuid);
  const id = txnid.trim();
  if (!loanAccountUuid.trim() || !id) return;
  try {
    await redis.client.sadd(key, id);
    await redis.client.expire(key, LOAN_TXNIDS_TTL_SEC);
  } catch {
    // best-effort
  }
}

export async function listLoanRepayTxnids(
  redis: RedisService,
  loanAccountUuid: string,
): Promise<string[]> {
  try {
    const members = await redis.client.smembers(repayIntentLoanRedisKey(loanAccountUuid));
    return members.map((item) => item.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function forgetLoanRepayTxnid(
  redis: RedisService,
  loanAccountUuid: string,
  txnid: string,
): Promise<void> {
  try {
    await redis.client.srem(repayIntentLoanRedisKey(loanAccountUuid), txnid.trim());
  } catch {
    // best-effort
  }
}

/** Compare INR amounts as paise (allows string "10.00" vs "10.0"). */
export function amountsMatchInr(a: string, b: string, tolerancePaise = 1): boolean {
  const toPaise = (v: string): number | null => {
    const n = Number.parseFloat(v.replace(/,/g, '').trim());
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  };
  const pa = toPaise(a);
  const pb = toPaise(b);
  if (pa == null || pb == null) return false;
  return Math.abs(pa - pb) <= tolerancePaise;
}

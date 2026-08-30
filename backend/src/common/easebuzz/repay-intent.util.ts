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
  paymentUrl?: string;
};

/** Reuse the same Easebuzz checkout if the customer taps Pay Now again. */
const REUSE_PENDING_MS = 30 * 60 * 1000;

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
    if (typeof parsed.paymentUrl === 'string') {
      parsed.paymentUrl = parsed.paymentUrl.trim() || undefined;
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

/** One live Pay Now per loan — drop older txnids so cron does not retrieve them all. */
export async function replaceLoanPendingTxnids(
  redis: RedisService,
  loanAccountUuid: string,
  keepTxnid: string,
): Promise<void> {
  const keep = keepTxnid.trim();
  const uuid = loanAccountUuid.trim();
  if (!uuid || !keep) return;
  for (const existing of await listLoanRepayTxnids(redis, uuid)) {
    if (existing === keep) continue;
    await clearPendingRepayIntent(redis, existing);
    await forgetLoanRepayTxnid(redis, uuid, existing);
  }
  await rememberLoanRepayTxnid(redis, uuid, keep);
}

export async function findReusableRepayIntent(
  redis: RedisService,
  loanAccountUuid: string,
  amountInr: string,
): Promise<{ txnid: string; intent: PendingRepayIntent } | null> {
  let best: { txnid: string; intent: PendingRepayIntent; at: number } | null = null;
  for (const txnid of await listLoanRepayTxnids(redis, loanAccountUuid)) {
    const intent = await loadPendingRepayIntent(redis, txnid);
    if (!intent?.paymentUrl) continue;
    if (!amountsMatchInr(intent.amountInr, amountInr)) continue;
    const at = Date.parse(intent.createdAt);
    if (!Number.isFinite(at) || Date.now() - at > REUSE_PENDING_MS) continue;
    if (!best || at > best.at) best = { txnid, intent, at };
  }
  return best ? { txnid: best.txnid, intent: best.intent } : null;
}

/** Newest Redis txnid that still has a live intent. Older members are forgotten. */
export async function keepLatestPendingLoanTxnid(
  redis: RedisService,
  loanAccountUuid: string,
): Promise<string | null> {
  const uuid = loanAccountUuid.trim();
  const ids = await listLoanRepayTxnids(redis, uuid);
  if (ids.length === 0) return null;

  let latest: { txnid: string; at: number } | null = null;
  for (const txnid of ids) {
    const intent = await loadPendingRepayIntent(redis, txnid);
    const at = intent ? Date.parse(intent.createdAt) : Number.NaN;
    const score = Number.isFinite(at) ? at : 0;
    if (!latest || score > latest.at) latest = { txnid, at: score };
  }
  if (!latest) return null;
  await replaceLoanPendingTxnids(redis, uuid, latest.txnid);
  return latest.txnid;
}

export async function forgetLoanRepayTxnid(
  redis: RedisService,
  loanAccountUuid: string,
  txnid: string,
): Promise<void> {
  try {
    const key = repayIntentLoanRedisKey(loanAccountUuid);
    await redis.client.srem(key, txnid.trim());
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

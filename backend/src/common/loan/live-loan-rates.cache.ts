/**
 * Module-level cache of current loan fee rates from the DB `setting` table
 * (PROCESSING_FEE, PROCESSING_FEE_GST).
 *
 * Used only when creating a new loan selection (snapshot into application_detail).
 * After that, all fee math (LOS, KFS, disbursement) must use the snapshotted
 * percentages on the application — never these live values.
 *
 * `SettingsRepository` registers the loader and primes the cache at boot.
 * Reads are stale-while-revalidate.
 */

export type LiveLoanFeeRates = {
  processingFeePercent: number;
  processingFeeGstPercent: number;
};

function cacheTtlMs(): number {
  const raw = process.env.LOAN_RATES_CACHE_TTL_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 600_000) return parsed;
  return 30_000;
}

let cached: { value: LiveLoanFeeRates; expiresAt: number } | null = null;
let loader: (() => Promise<LiveLoanFeeRates>) | null = null;
let refreshing = false;

function refreshInBackground(): void {
  if (!loader || refreshing) return;
  refreshing = true;
  loader()
    .then((value) => {
      cached = { value, expiresAt: Date.now() + cacheTtlMs() };
    })
    .catch(() => {
      // Keep serving the previous value; next read retries.
    })
    .finally(() => {
      refreshing = false;
    });
}

/** Called once at boot (SettingsRepository.onModuleInit). */
export function registerLiveLoanFeeRatesLoader(fn: () => Promise<LiveLoanFeeRates>): void {
  loader = fn;
  refreshInBackground();
}

/**
 * Current DB fee rates, or `null` when the cache was never primed.
 * Do not use for amounts on an existing application — use application_detail.
 */
export function getLiveLoanFeeRates(): LiveLoanFeeRates | null {
  if (!cached) {
    refreshInBackground();
    return null;
  }
  if (Date.now() > cached.expiresAt) refreshInBackground();
  return cached.value;
}

/** Test hook. */
export function resetLiveLoanFeeRatesForTests(): void {
  cached = null;
  loader = null;
  refreshing = false;
}

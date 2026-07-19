/**
 * Module-level cache of the current loan fee rates from the DB `setting`
 * table (PROCESSING_FEE, PROCESSING_FEE_GST). It exists so the synchronous
 * fee computation in `loan-disbursement-view.util.ts` can use live DB values
 * without every consumer having to load settings — admin changes apply
 * "on the fly" across the customer portal, LOS, loan documents, and
 * disbursement without touching call sites.
 *
 * `SettingsRepository` registers the loader and primes the cache at boot.
 * Reads are stale-while-revalidate: an expired value is still returned while
 * a background refresh runs, so callers never block on the DB.
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
 * Current DB fee rates, or `null` when the cache was never primed (unit
 * tests, very early boot) — callers then fall back to row snapshots.
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

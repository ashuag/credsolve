/**
 * `lead_detail.bureau_fetched` SmallInt status codes.
 *
 *   0 → NOT_FETCHED — No bureau pull completed yet (or skipped without DB write).
 *   1 → SUCCESS     — Tenacio bureau soft-pull returned OK.
 *   2 → FAILED      — Transport/vendor error or non-success after an attempt.
 */
export const BUREAU_FETCHED = {
  NOT_FETCHED: 0,
  SUCCESS: 1,
  FAILED: 2,
} as const;

export type BureauFetchedStatus = (typeof BUREAU_FETCHED)[keyof typeof BUREAU_FETCHED];

/**
 * `lead.pan_verified` SmallInt status codes.
 *
 *   0 → NOT_CHECKED   — API not yet called, or network/timeout error.
 *                        Safe to retry later.
 *   1 → VERIFIED      — Vendor confirmed: panStatus=valid, nameMatch=true,
 *                        dobMatch=true, category=Individual.
 *   2 → NOT_VERIFIED  — Vendor responded successfully but PAN is invalid,
 *                        name/DOB didn't match, or category is wrong.
 *   3 → API_FAILURE   — Vendor returned `success: false` / non-success
 *                        envelope (e.g. 400 bad request, malformed input).
 *                        Safe to retry after fixing input.
 *   4 → API_DISABLED  — PAN verification is turned off in settings.
 *                        Will be retried when the setting is re-enabled.
 */
export const PAN_VERIFIED = {
  NOT_CHECKED: 0,
  VERIFIED: 1,
  NOT_VERIFIED: 2,
  API_FAILURE: 3,
  API_DISABLED: 4,
} as const;

export type PanVerifiedStatus = (typeof PAN_VERIFIED)[keyof typeof PAN_VERIFIED];

/** Mirrors backend `lead.pan_verified` codes used for LOS alert display. */
const PAN_VERIFIED = {
  VERIFIED: 1,
  NOT_VERIFIED: 2,
  API_FAILURE: 3,
  API_DISABLED: 4,
} as const;

/** Mirrors backend `lead.bureau_fetched` codes. */
const BUREAU_FETCHED = {
  SUCCESS: 1,
  FAILED: 2,
} as const;

export type WorkspaceAlertInput = {
  statusCode: string;
  rejectionReason?: string | null;
  leadStatusNote?: string | null;
  bureauFetchedNote?: string | null;
  panVerified?: number;
  bureauFetched?: number;
};

/** Human-readable alert shown under lead/application headers (orange = warning, red = rejected). */
export function buildWorkspaceAlertText(input: WorkspaceAlertInput): string | null {
  const parts: string[] = [];
  const rejection = input.rejectionReason?.trim();
  const note = input.leadStatusNote?.trim();
  const bureauNote = input.bureauFetchedNote?.trim();
  const isRejected = input.statusCode.toUpperCase().includes('REJECT');

  if (rejection) parts.push(rejection);

  const panFailed =
    input.panVerified === PAN_VERIFIED.NOT_VERIFIED ||
    input.panVerified === PAN_VERIFIED.API_FAILURE ||
    input.panVerified === PAN_VERIFIED.API_DISABLED;

  if (note && (panFailed || isRejected)) {
    parts.push(note);
  }

  if (input.bureauFetched === BUREAU_FETCHED.FAILED && bureauNote) {
    parts.push(`Bureau: ${bureauNote}`);
  }

  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join(' · ') : null;
}

export function isWorkspaceRecordRejected(statusCode: string, rejectionReason?: string | null): boolean {
  return statusCode.toUpperCase().includes('REJECT') || Boolean(rejectionReason?.trim());
}

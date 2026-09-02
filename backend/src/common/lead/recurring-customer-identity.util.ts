export type RecurringLockedIdentity = {
  fullName: string;
  dateOfBirth: Date;
  panNumber: string;
  genderId: number;
};

/** Identity fields that stay fixed after a disbursed loan is repaid (CLOSED). */
export function recurringLockedIdentityFromPriorDetail(detail: {
  fullName: string | null;
  dateOfBirth: Date | null;
  panNumber: string | null;
  genderId: number | null;
} | null): RecurringLockedIdentity | null {
  if (!detail?.fullName?.trim() || !detail.dateOfBirth || !detail.panNumber?.trim() || detail.genderId == null) {
    return null;
  }
  return {
    fullName: detail.fullName.trim(),
    dateOfBirth: detail.dateOfBirth,
    panNumber: detail.panNumber.trim().toUpperCase(),
    genderId: detail.genderId,
  };
}

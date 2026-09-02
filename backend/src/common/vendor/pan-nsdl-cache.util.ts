/** Calendar date in UTC for `pan_nsdl.date_of_birth` (`DATE`). */
export function toUtcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function toIsoDateOnlyUtc(value: Date): string {
  return toUtcDateOnly(value).toISOString().slice(0, 10);
}

/** Lookup / unique key: PAN + uppercase name as sent to NSDL + DOB. */
export function normalizePanNsdlCacheIdentity(input: {
  panNumber: string;
  fullName: string;
  dateOfBirth: Date;
}): { panNumber: string; fullName: string; dateOfBirth: Date } {
  return {
    panNumber: input.panNumber.trim().toUpperCase(),
    fullName: input.fullName.trim().toUpperCase(),
    dateOfBirth: toUtcDateOnly(input.dateOfBirth),
  };
}

/** Cache insert rule: NSDL pan valid and DOB match. Name/category do not gate insert. */
export function isPanAndDobVerifiedForCache(result: {
  panStatus: string | null;
  dobMatch: boolean;
}): boolean {
  return result.panStatus === 'valid' && result.dobMatch === true;
}

export function panNsdlIdentitiesEqual(
  left: { panNumber: string; fullName: string; dateOfBirth: Date },
  right: { panNumber: string; fullName: string; dateOfBirth: Date },
): boolean {
  const a = normalizePanNsdlCacheIdentity(left);
  const b = normalizePanNsdlCacheIdentity(right);
  return (
    a.panNumber === b.panNumber &&
    a.fullName === b.fullName &&
    a.dateOfBirth.getTime() === b.dateOfBirth.getTime()
  );
}

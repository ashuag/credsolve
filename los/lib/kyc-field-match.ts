export type KycMatchVerdict = 'match' | 'partial' | 'mismatch' | 'missing';

export function normalizeComparablePersonName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function normalizeAadhaarGender(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim().toUpperCase();
  if (value === 'M' || value === 'MALE') return 'Male';
  if (value === 'F' || value === 'FEMALE') return 'Female';
  if (value === 'T' || value === 'O' || value === 'OTHERS' || value === 'OTHER') return 'Others';
  return raw.trim();
}

export function normalizeProfileGender(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw.trim();
}

export function computeNameMatchScore(left: string | null | undefined, right: string | null | undefined): number {
  const a = normalizeComparablePersonName(left ?? '');
  const b = normalizeComparablePersonName(right ?? '');
  if (!a || !b) return 0;
  if (a === b) return 100;

  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = new Set(b.split(' ').filter(Boolean));
  const intersection = tokensA.filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  if (union === 0) return 0;
  return Math.round((intersection / union) * 100);
}

export function nameMatchVerdict(score: number, hasBoth: boolean): KycMatchVerdict {
  if (!hasBoth) return 'missing';
  if (score >= 100) return 'match';
  if (score >= 70) return 'partial';
  return 'mismatch';
}

export function compareIsoDates(
  left: string | null | undefined,
  right: string | null | undefined,
): KycMatchVerdict {
  const a = left?.trim().slice(0, 10);
  const b = right?.trim().slice(0, 10);
  if (!a || !b) return 'missing';
  return a === b ? 'match' : 'mismatch';
}

/**
 * Worst-case verdict across profile comparisons (Aadhaar, CIBIL, …).
 * A mismatch against any available source wins over match / N/A.
 */
export function combineMatchVerdicts(...verdicts: KycMatchVerdict[]): KycMatchVerdict {
  if (verdicts.includes('mismatch')) return 'mismatch';
  if (verdicts.includes('partial')) return 'partial';
  if (verdicts.includes('match')) return 'match';
  return 'missing';
}

export function compareGenders(
  profileGender: string | null | undefined,
  aadhaarGender: string | null | undefined,
): KycMatchVerdict {
  const left = normalizeProfileGender(profileGender);
  const right = normalizeAadhaarGender(aadhaarGender);
  if (!left || !right) return 'missing';
  return left.toLowerCase() === right.toLowerCase() ? 'match' : 'mismatch';
}

export function normalizePan(value: string | null | undefined): string | null {
  const pan = value?.trim().toUpperCase();
  return pan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) ? pan : null;
}

export function extractCibilPan(identifiers: Array<{ type: string; number: string }>): string | null {
  for (const identifier of identifiers) {
    const type = identifier.type.toLowerCase();
    if (!type.includes('pan') && !type.includes('income tax')) continue;
    const pan = normalizePan(identifier.number);
    if (pan) return pan;
  }
  return null;
}

export function comparePan(
  profilePan: string | null | undefined,
  bureauPan: string | null | undefined,
): KycMatchVerdict {
  const left = normalizePan(profilePan);
  const right = normalizePan(bureauPan);
  if (!left || !right) return 'missing';
  return left === right ? 'match' : 'mismatch';
}

export function ageYearsFromDateOfBirth(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const dob = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  if (now < dob) return null;

  let years = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    years -= 1;
  }
  return years;
}

export function formatDobWithAge(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const formatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const age = ageYearsFromDateOfBirth(iso);
  return age != null ? `${formatted} (${age} yrs)` : formatted;
}

export function formatAadhaarNumberDisplay(
  maskedAadhaar: string | null | undefined,
  digilockerCaptured: boolean,
): string {
  if (maskedAadhaar?.trim()) return maskedAadhaar.trim();
  if (digilockerCaptured) return 'Not stored (DigiLocker)';
  return '—';
}

export function dedupeCibilPhones<T extends { type: string; number: string }>(phones: T[]): Array<T & { label: string }> {
  const grouped = new Map<string, { types: string[]; number: string; phone: T }>();

  for (const phone of phones) {
    const normalized = phone.number.replace(/\D/g, '');
    if (!normalized) continue;
    const existing = grouped.get(normalized);
    if (existing) {
      existing.types.push(phone.type || 'Phone');
      continue;
    }
    grouped.set(normalized, {
      types: [phone.type || 'Phone'],
      number: phone.number,
      phone,
    });
  }

  return [...grouped.values()].map(({ types, number, phone }) => ({
    ...phone,
    number,
    label: types.length > 1 ? `${types.join(', ')}` : types[0] ?? 'Phone',
  }));
}

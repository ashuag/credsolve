export function formatReviewDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatReviewDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatReviewInr(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function formatReviewInrSigned(value: number, negative = false): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
  return negative ? `−${formatted}` : formatted;
}

export function parseInrNumber(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function personInitials(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function truncateUuid(uuid: string, head = 28): string {
  return uuid.length > head ? `${uuid.slice(0, head)}…` : uuid;
}

export function maskPan(pan: string): string {
  const p = pan.trim().toUpperCase();
  if (p.length < 10) return p;
  return `${p.slice(0, 5)}••••${p.slice(-1)}`;
}

export function maskAccount(account: string): string {
  const digits = account.replace(/\D/g, '');
  if (digits.length <= 4) return '••••';
  return `••••••${digits.slice(-4)}`;
}

export function leadSourceLabel(sourceName: string | null | undefined, sourceType: string | null | undefined): string {
  if (!sourceName) return 'Unattributed source';
  return sourceType ? `${sourceName} · ${sourceType}` : sourceName;
}

export function cibilScoreBand(score: number | null | undefined): string {
  if (score == null) return '—';
  if (score >= 750) return 'Excellent — low risk band';
  if (score >= 700) return 'Good — low risk band';
  if (score >= 650) return 'Fair — review carefully';
  return 'Below threshold — high risk band';
}

export function formatApplicationDisplayId(uuid: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  const suffix = uuid.replace(/-/g, '').slice(-5).toUpperCase();
  return `APP-${year}-${suffix}`;
}

export function formatCityState(
  city: string | null | undefined,
  state: string | null | undefined,
): string {
  const parts = [city?.trim(), state?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

export function isApplicationIdentityVerified(input: {
  kycStatus: number;
  panVerified: number;
  hasAadhaar: boolean;
}): boolean {
  return input.kycStatus === 1 && input.panVerified === 1 && input.hasAadhaar;
}

/** Format decimal amount strings from the API as INR. */
export function formatInr(amount: string | null | undefined): string {
  if (amount == null || amount === '') return '—';
  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

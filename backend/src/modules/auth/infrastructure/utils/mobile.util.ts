export function normalizeMobile(value: string | number): string {
  const raw = typeof value === 'number' ? String(value) : value.trim();
  return raw.replace(/\D/g, '');
}

export function isValidIndianMobile(mobile: string): boolean {
  return /^\d{10}$/.test(mobile);
}

export function maskMobile(mobile: string): string {
  if (mobile.length < 4) {
    return '****';
  }
  return `******${mobile.slice(-4)}`;
}

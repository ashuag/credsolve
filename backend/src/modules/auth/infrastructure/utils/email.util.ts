const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 100 && EMAIL_RE.test(email);
}

/** Contact email on `lead_detail.email_id` (no OTP). Matches VARCHAR(150). */
export function isValidContactEmail(email: string): boolean {
  return email.length > 0 && email.length <= 150 && EMAIL_RE.test(email);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || !local) {
    return '***';
  }
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

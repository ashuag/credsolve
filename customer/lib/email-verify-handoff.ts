/** Short-lived handoff so `/email-verify` can render immediately after loan selection. */

const STORAGE_KEY = 'mc.emailVerifyHandoff';

export type EmailVerifyHandoff = {
  leadUuid: string;
  email: string | null;
  emailVerified: boolean;
  mobileNumber: string;
  loanSelection: {
    amountInr: string | null;
    tenureDays: number | null;
    maturityDate: string | null;
  } | null;
  savedAt: number;
};

const MAX_AGE_MS = 15 * 60 * 1000;

export function saveEmailVerifyHandoff(payload: Omit<EmailVerifyHandoff, 'savedAt'>): void {
  try {
    const body: EmailVerifyHandoff = { ...payload, savedAt: Date.now() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(body));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readEmailVerifyHandoff(): EmailVerifyHandoff | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmailVerifyHandoff;
    if (!parsed?.leadUuid || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearEmailVerifyHandoff(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

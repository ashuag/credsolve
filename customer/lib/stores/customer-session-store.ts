import { getApiUrl } from '../api-url';
import type { CustomerProfile } from '../customer-auth';

export const CUSTOMER_SESSION_EVENT = 'mc:customer-session-changed';

type CustomerSessionResponse = {
  authenticated?: unknown;
  customerId?: unknown;
  mobileNumber?: unknown;
};

type CustomerSessionState = {
  profile: CustomerProfile | null;
  hasHydrated: boolean;
  isHydrating: boolean;
};

const state: CustomerSessionState = {
  profile: null,
  hasHydrated: false,
  isHydrating: false
};

let hydrationPromise: Promise<void> | null = null;

function emitCustomerSessionChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(CUSTOMER_SESSION_EVENT));
}

function normalizeCustomerProfile(value: unknown): CustomerProfile | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.customerId !== 'string') return null;

  return {
    customerId: candidate.customerId,
    mobileNumber: typeof candidate.mobileNumber === 'string' ? candidate.mobileNumber : null
  };
}

async function fetchCookieSessionProfile(): Promise<CustomerProfile | null> {
  if (typeof window === 'undefined') return null;

  try {
    const response = await fetch(`${getApiUrl()}/auth/me`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include'
    });

    if (!response.ok) return null;

    const data = (await response.json().catch(() => null)) as CustomerSessionResponse | null;

    if (data?.authenticated !== true) return null;

    return normalizeCustomerProfile(data);
  } catch {
    return null;
  }
}

function commit(nextProfile: CustomerProfile | null) {
  state.profile = nextProfile;
  state.hasHydrated = true;
  state.isHydrating = false;
  emitCustomerSessionChange();
}

export function hydrateCustomerSessionStore(): Promise<void> {
  if (state.hasHydrated) {
    return Promise.resolve();
  }

  if (state.isHydrating && hydrationPromise) {
    return hydrationPromise;
  }

  state.isHydrating = true;

  hydrationPromise = fetchCookieSessionProfile()
    .then((profile) => {
      commit(profile);
    })
    .finally(() => {
      hydrationPromise = null;
    });

  return hydrationPromise;
}

export function setCustomerProfile(profile: CustomerProfile): void {
  commit(profile);
}

export function clearCustomerSessionStoreSession(): void {
  commit(null);
}

export function getCustomerProfile(): CustomerProfile | null {
  return state.profile;
}

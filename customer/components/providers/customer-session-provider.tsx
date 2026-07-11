'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchCustomerSession,
  type CustomerSessionResponse,
} from '@/lib/api/customer-session';
import { logoutCustomer } from '@/lib/api/auth';

type CustomerSessionContextValue = {
  /** True until the first `/auth/me` fetch completes. */
  loading: boolean;
  /** `null` only before the first fetch; then authenticated or not. */
  session: CustomerSessionResponse | null;
  /** Reloads session from `GET /auth/me` and returns the result. */
  refresh: () => Promise<CustomerSessionResponse>;
  /** Clears the HttpOnly cookie server-side and resets client session to signed-out. */
  signOut: () => Promise<void>;
};

const CustomerSessionContext = createContext<CustomerSessionContextValue | undefined>(undefined);

export function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CustomerSessionResponse | null>(null);
  /** Only the first `/auth/me` fetch toggles `loading`; later refreshes update `session` silently. */
  const isInitialLoadRef = useRef(true);
  /** Ignore outdated refresh results so a slow response cannot clobber a newer one. */
  const refreshSeqRef = useRef(0);

  const refresh = useCallback(async (): Promise<CustomerSessionResponse> => {
    const isInitialLoad = isInitialLoadRef.current;
    if (isInitialLoad) {
      setLoading(true);
    }
    const seq = ++refreshSeqRef.current;
    try {
      const next = await fetchCustomerSession({ force: true });
      // A newer refresh started while we were in flight — do not overwrite state.
      if (seq !== refreshSeqRef.current) {
        return next;
      }
      let applied = next;
      setSession((prev) => {
        // Never let a stale anonymous payload wipe a known signed-in session.
        if (
          prev &&
          prev.authenticated === true &&
          prev.lead &&
          (next.authenticated !== true || !next.lead)
        ) {
          applied = prev;
          return prev;
        }
        return next;
      });
      return applied;
    } catch {
      if (seq !== refreshSeqRef.current) {
        return { authenticated: false };
      }
      // Keep an existing signed-in session if a transient fetch fails.
      let preserved: CustomerSessionResponse = { authenticated: false };
      setSession((prev) => {
        if (prev && prev.authenticated === true && prev.lead) {
          preserved = prev;
          return prev;
        }
        return { authenticated: false };
      });
      return preserved;
    } finally {
      if (isInitialLoad) {
        isInitialLoadRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await logoutCustomer();
    } catch {
      /* still clear local session — cookie may already be gone */
    }
    // Invalidate any in-flight refresh so it cannot restore the previous session.
    refreshSeqRef.current += 1;
    isInitialLoadRef.current = false;
    setSession({ authenticated: false });
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      loading,
      session,
      refresh,
      signOut,
    }),
    [loading, session, refresh, signOut]
  );

  return <CustomerSessionContext.Provider value={value}>{children}</CustomerSessionContext.Provider>;
}

export function useCustomerSession(): CustomerSessionContextValue {
  const ctx = useContext(CustomerSessionContext);
  if (!ctx) {
    throw new Error('useCustomerSession must be used within CustomerSessionProvider');
  }
  return ctx;
}

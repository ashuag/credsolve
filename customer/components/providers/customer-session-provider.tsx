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

type CustomerSessionContextValue = {
  /** True until the first `/auth/me` fetch completes. */
  loading: boolean;
  /** `null` only before the first fetch; then authenticated or not. */
  session: CustomerSessionResponse | null;
  /** Reloads session from `GET /auth/me` and returns the result. */
  refresh: () => Promise<CustomerSessionResponse>;
};

const CustomerSessionContext = createContext<CustomerSessionContextValue | undefined>(undefined);

export function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CustomerSessionResponse | null>(null);
  /** Only the first `/auth/me` fetch toggles `loading`; later refreshes update `session` silently. */
  const isInitialLoadRef = useRef(true);

  const refresh = useCallback(async (): Promise<CustomerSessionResponse> => {
    const isInitialLoad = isInitialLoadRef.current;
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      const next = await fetchCustomerSession({ force: true });
      setSession(next);
      return next;
    } catch {
      const fallback: CustomerSessionResponse = { authenticated: false };
      setSession(fallback);
      return fallback;
    } finally {
      if (isInitialLoad) {
        isInitialLoadRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      loading,
      session,
      refresh,
    }),
    [loading, session, refresh]
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

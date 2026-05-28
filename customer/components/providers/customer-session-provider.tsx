'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  const refresh = useCallback(async (): Promise<CustomerSessionResponse> => {
    setLoading(true);
    try {
      const next = await fetchCustomerSession({ force: true });
      setSession(next);
      return next;
    } catch {
      const fallback: CustomerSessionResponse = { authenticated: false };
      setSession(fallback);
      return fallback;
    } finally {
      setLoading(false);
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

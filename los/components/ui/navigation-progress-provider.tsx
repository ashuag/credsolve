'use client';

import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { RouteTransitionLoader } from '@/components/ui/route-transition-loader';

type NavigationProgressInput = {
  href?: string;
  label?: string;
};

type PendingNavigation = {
  href: string;
  label: string;
};

type NavigationProgressContextValue = {
  isNavigating: boolean;
  startNavigation: (navigation: NavigationProgressInput) => void;
  clearNavigation: () => void;
};

const NavigationProgressContext = createContext<NavigationProgressContextValue | null>(null);
const NAVIGATION_LOADER_DELAY_MS = 180;
const NAVIGATION_LOADER_TIMEOUT_MS = 12000;

export function NavigationProgressProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  function clearTimers() {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  useEffect(() => {
    clearTimers();
    setIsNavigating(false);
    setPendingNavigation(null);
  }, [pathname]);

  useEffect(() => {
    if (!pendingNavigation) return;
    hideTimerRef.current = window.setTimeout(() => {
      setIsNavigating(false);
      setPendingNavigation(null);
      hideTimerRef.current = null;
    }, NAVIGATION_LOADER_TIMEOUT_MS);
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [pendingNavigation]);

  function startNavigation(navigation: NavigationProgressInput) {
    clearTimers();
    setIsNavigating(true);
    const nextNavigation = {
      href: navigation.href ?? pathname,
      label: navigation.label?.trim() || 'the next page',
    };

    showTimerRef.current = window.setTimeout(() => {
      setPendingNavigation(nextNavigation);
      showTimerRef.current = null;
    }, NAVIGATION_LOADER_DELAY_MS);
  }

  function clearNavigation() {
    clearTimers();
    setIsNavigating(false);
    setPendingNavigation(null);
  }

  return (
    <NavigationProgressContext.Provider
      value={{
        isNavigating,
        startNavigation,
        clearNavigation,
      }}
    >
      {children}
      {pendingNavigation ? <RouteTransitionLoader destination={pendingNavigation.label} /> : null}
    </NavigationProgressContext.Provider>
  );
}

export function useNavigationProgress() {
  const context = useContext(NavigationProgressContext);
  if (!context) throw new Error('useNavigationProgress must be used within NavigationProgressProvider.');
  return context;
}

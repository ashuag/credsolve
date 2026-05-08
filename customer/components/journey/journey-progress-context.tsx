'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type JourneyProgressContextValue = {
  /** 0–1 completion within the onboarding journey (email → OTP → details). */
  completion01: number;
  setCompletion01: (value: number) => void;
};

const JourneyProgressContext = createContext<JourneyProgressContextValue | null>(null);

export function JourneyProgressProvider({ children }: { children: ReactNode }) {
  const [completion01, setCompletion01State] = useState(0.06);
  const setCompletion01 = useCallback((value: number) => {
    setCompletion01State(Math.min(1, Math.max(0, value)));
  }, []);
  const value = useMemo(
    () => ({ completion01, setCompletion01 }),
    [completion01, setCompletion01],
  );
  return (
    <JourneyProgressContext.Provider value={value}>{children}</JourneyProgressContext.Provider>
  );
}

export function useJourneyProgressOptional(): JourneyProgressContextValue | null {
  return useContext(JourneyProgressContext);
}

import { useEffect, useState } from 'react';

/**
 * Returns the number of seconds remaining until `targetIso`.
 * Updates every second. Returns 0 when no target is provided or when elapsed.
 */
export function useCountdown(targetIso: string | null | undefined): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!targetIso) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [targetIso]);

  if (!targetIso) return 0;
  return Math.max(0, Math.ceil((new Date(targetIso).getTime() - now) / 1000));
}

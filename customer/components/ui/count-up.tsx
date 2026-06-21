'use client';

import { useEffect, useRef, useState } from 'react';

type CountUpProps = {
  to: number;
  prefix?: string;
  suffix?: string;
  /** Animation duration in ms. Defaults to 1800. */
  duration?: number;
  /** Locale used for grouping. Defaults to en-IN. */
  locale?: string;
  /** Number of decimal places to display. Defaults to 0 (integer). */
  decimals?: number;
  className?: string;
};

/**
 * Counts from 0 to `to` once when scrolled into view, using an easeOutCubic curve.
 * The animation runs at most once per mount and stops cleanly on unmount.
 */
export function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 1800,
  locale = 'en-IN',
  decimals = 0,
  className = 'tabular-nums',
}: CountUpProps) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rafId = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || ranRef.current) return;
        ranRef.current = true;
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min((t - t0) / duration, 1);
          const raw = (1 - (1 - p) ** 3) * to;
          setVal(decimals > 0 ? Number(raw.toFixed(decimals)) : Math.round(raw));
          if (p < 1) rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [to, duration, decimals]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {val.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

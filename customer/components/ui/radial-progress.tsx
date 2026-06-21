'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type RadialProgressProps = {
  /** Target fill, 0–100. */
  value: number;
  /** Progress arc color. */
  color: string;
  /** Track (unfilled) color. */
  trackColor?: string;
  /** Diameter in px. */
  size?: number;
  /** Arc thickness in px. */
  strokeWidth?: number;
  /** Animation duration in ms. */
  duration?: number;
  /** Centered content (number, icon, etc.). */
  children?: ReactNode;
  className?: string;
};

/**
 * Animated circular progress gauge. Fills from 0 to `value` once when scrolled
 * into view using an easeOutCubic curve. Honors prefers-reduced-motion.
 */
export function RadialProgress({
  value,
  color,
  trackColor = 'rgba(255,255,255,0.12)',
  size = 116,
  strokeWidth = 8,
  duration = 1600,
  children,
  className = '',
}: RadialProgressProps) {
  const [progress, setProgress] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setProgress(value);
      return;
    }

    let rafId = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || ranRef.current) return;
        ranRef.current = true;
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min((t - t0) / duration, 1);
          setProgress((1 - (1 - p) ** 3) * value);
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
  }, [value, duration]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);

  return (
    <div
      ref={ref}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

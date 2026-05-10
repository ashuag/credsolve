'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Root-level error boundary for the LOS app. Caught at the segment level so
 * any unhandled error inside a route renders this UI instead of a blank page.
 * `digest` (when present) is the server-side hash you can use to find the
 * matching entry in your logs.
 */
export default function LosRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[LOS] route error', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--los-bg,#f4f7ff)]">
      <div className="w-full max-w-md rounded-[14px] border border-[rgba(23,44,113,0.12)] bg-white p-6 shadow-[0_8px_28px_rgba(23,44,113,0.08)]">
        <h1 className="text-[1.15rem] font-extrabold text-brand-navy">Something went wrong.</h1>
        <p className="mt-2 text-[0.88rem] leading-relaxed text-brand-muted">
          We hit an unexpected error rendering this page. The team has been notified.
          You can retry, or head back to the dashboard.
        </p>
        {error.digest ? (
          <p className="mt-3 text-[0.72rem] font-mono text-brand-muted/80">
            Error ID: <span className="font-semibold">{error.digest}</span>
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="los-btn-primary flex-1"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex flex-1 items-center justify-center rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 py-2 text-[0.86rem] font-bold text-brand-text"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

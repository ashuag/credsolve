'use client';

import { useEffect } from 'react';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    void import('@sentry/nextjs')
      .then((Sentry) => Sentry.captureException(error))
      .catch(() => undefined);
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4">
      <div className="mc-card mc-card-glow max-w-md w-full text-center">
        <div className="mc-chip mx-auto">Something went wrong</div>
        <h1 className="mt-4 mb-3 text-brand-navy text-[clamp(2rem,6vw,2.8rem)] leading-[0.96] tracking-[-0.05em]">
          Unexpected error.
        </h1>
        <p className="text-brand-muted leading-[1.6] mb-6">
          We ran into an issue loading this page. Your data is safe — please try again or contact support if the
          problem persists.
        </p>
        <button type="button" onClick={reset} className="mc-btn-primary w-full">
          Try again
        </button>
      </div>
    </div>
  );
}

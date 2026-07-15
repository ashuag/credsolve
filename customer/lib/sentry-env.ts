/** Shared Sentry env helpers for customer Next.js runtimes. */

export function sentryDsn(): string | undefined {
  const dsn = (process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? '').trim();
  return dsn || undefined;
}

export function sentryEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
    process.env.SENTRY_ENVIRONMENT?.trim() ||
    process.env.NODE_ENV?.trim() ||
    'development'
  );
}

export function sentryTracesSampleRate(): number {
  const raw = (
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
    process.env.SENTRY_TRACES_SAMPLE_RATE ??
    ''
  ).trim();
  if (raw) {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  }
  return sentryEnvironment() === 'production' ? 0.1 : 1;
}

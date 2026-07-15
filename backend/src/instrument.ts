import * as Sentry from '@sentry/nestjs';

function sampleRate(envKey: string, fallback: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

const dsn = process.env.SENTRY_DSN?.trim();
const environment =
  process.env.SENTRY_ENVIRONMENT?.trim() ||
  process.env.NODE_ENV?.trim() ||
  'development';

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  environment,
  release: process.env.SENTRY_RELEASE?.trim() || undefined,
  tracesSampleRate: sampleRate(
    'SENTRY_TRACES_SAMPLE_RATE',
    environment === 'production' ? 0.1 : 1,
  ),
  sendDefaultPii: false,
});

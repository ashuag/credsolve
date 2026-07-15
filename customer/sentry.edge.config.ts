import { sentryDsn, sentryEnvironment, sentryTracesSampleRate } from './lib/sentry-env';

const dsn = sentryDsn();

void import('@sentry/nextjs')
  .then((Sentry) => {
    Sentry.init({
      dsn,
      enabled: Boolean(dsn),
      environment: sentryEnvironment(),
      tracesSampleRate: sentryTracesSampleRate(),
      sendDefaultPii: false,
    });
  })
  .catch(() => {
    // Package not installed yet.
  });

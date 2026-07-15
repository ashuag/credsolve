import * as Sentry from '@sentry/nextjs';
import { sentryDsn, sentryEnvironment, sentryTracesSampleRate } from './lib/sentry-env';

const dsn = sentryDsn();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: sentryEnvironment(),
  tracesSampleRate: sentryTracesSampleRate(),
  sendDefaultPii: false,
});

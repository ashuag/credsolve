import * as Sentry from '@sentry/nextjs';
import { sentryDsn, sentryEnvironment, sentryTracesSampleRate } from './lib/sentry-env';

const dsn = sentryDsn();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: sentryEnvironment(),
  tracesSampleRate: sentryTracesSampleRate(),
  sendDefaultPii: false,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  // Capture sessions only when an error occurs (financial app — avoid full-session replay by default).
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: dsn ? 1 : 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

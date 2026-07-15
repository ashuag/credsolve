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
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: dsn ? 1 : 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

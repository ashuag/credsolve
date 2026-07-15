import { sentryDsn, sentryEnvironment, sentryTracesSampleRate } from './lib/sentry-env';

const dsn = sentryDsn();

async function initSentryClient() {
  try {
    const Sentry = await import('@sentry/nextjs');
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
    return Sentry.captureRouterTransitionStart;
  } catch {
    return undefined;
  }
}

const routerTransitionPromise = initSentryClient();

export const onRouterTransitionStart = (...args: unknown[]) => {
  void routerTransitionPromise.then((fn) => {
    if (typeof fn === 'function') {
      // Sentry's captureRouterTransitionStart typing varies by SDK version.
      (fn as (...a: unknown[]) => void)(...args);
    }
  });
};

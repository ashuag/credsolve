import { sentryDsn, sentryEnvironment, sentryTracesSampleRate } from './lib/sentry-env';

const dsn = sentryDsn();

/** Safari / WebKit media-controls bug: accessing `.played` on a collected media object. */
function isWebkitEmptyRangesError(message: string | undefined): boolean {
  return typeof message === 'string' && message.includes('EmptyRanges');
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      if (!isWebkitEmptyRangesError(event.message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
}

async function initSentryClient() {
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      enabled: Boolean(dsn),
      environment: sentryEnvironment(),
      tracesSampleRate: sentryTracesSampleRate(),
      sendDefaultPii: false,
      ignoreErrors: ['EmptyRanges'],
      integrations: [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
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
      (fn as (...a: unknown[]) => void)(...args);
    }
  });
};

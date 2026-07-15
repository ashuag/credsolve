export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./sentry.server.config');
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('./sentry.edge.config');
    }
  } catch (error) {
    // `@sentry/nextjs` may not be installed yet (fresh clone / pending npm install).
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[sentry] skipped server init:', error instanceof Error ? error.message : error);
    }
  }
}

export async function onRequestError(
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
) {
  try {
    const Sentry = await import('@sentry/nextjs');
    return Sentry.captureRequestError(...args);
  } catch {
    // no-op when Sentry is not installed
  }
}

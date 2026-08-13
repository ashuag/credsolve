import type { NextConfig } from 'next';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLosServerApiBase } from './lib/api-env';

const require = createRequire(import.meta.url);

function withOptionalSentry(config: NextConfig): NextConfig {
  try {
    // Optional until `npm install` has pulled `@sentry/nextjs` into node_modules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { withSentryConfig } = require('@sentry/nextjs') as {
      withSentryConfig: (cfg: NextConfig, opts: Record<string, unknown>) => NextConfig;
    };
    return withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      tunnelRoute: '/sentry-tunnel',
      widenClientFileUpload: true,
      disableLogger: true,
    });
  } catch {
    return config;
  }
}

const configDir = path.dirname(fileURLToPath(import.meta.url));
const envDistDir = process.env.NEXT_DIST_DIR?.trim();
const isProductionRuntime = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// Fail fast at build/start if the server-side API proxy target is misconfigured.
const losApiProxyBase = getLosServerApiBase().replace(/\/$/, '');

const securityHeaders: { key: string; value: string }[] = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

if (isProductionRuntime) {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  });
}

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Let the edge reverse proxy handle compression — avoids double-compression 500s
  // and ERR_HTTP_HEADERS_SENT when Next and the proxy both gzip the same response.
  compress: false,
  compiler: {
    removeConsole: isProductionRuntime ? { exclude: ['error', 'warn'] } : false,
  },
  allowedDevOrigins,
  // Next dev can intermittently miss generated manifests with custom distDir.
  // Keep default `.next` for development and allow overrides for non-dev runs.
  distDir: isProductionRuntime ? envDistDir || '.next' : '.next',
  outputFileTracingRoot: configDir,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  /**
   * `beforeFiles` runs before the App Router. That mirrors how customer reliably reaches Nest
   * via same-origin `/api/*`, and avoids stale Turbopack / `.next` volume 404s on `/api/los/*`.
   * Destination must be absolute so the LOS container can reach the `backend` service.
   */
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/los/:path*',
          destination: `${losApiProxyBase}/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withOptionalSentry(nextConfig);

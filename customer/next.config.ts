import type { NextConfig } from 'next';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCustomerServerApiBase } from './lib/nest-api-base';

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
      // Tunnel through Next to reduce ad-blocker drops of browser events.
      tunnelRoute: '/sentry-tunnel',
      widenClientFileUpload: true,
      // Webpack production builds: drop Sentry debug logger calls from the bundle.
      // (No-op under Turbopack — tree-shaking is webpack-only.)
      webpack: {
        treeshake: {
          removeDebugLogging: true,
        },
      },
    });
  } catch {
    return config;
  }
}

const allowedDevOrigins = [
  'localhost',
  '127.0.0.1',
  ...(process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '').split(','),
]
  .map((value) => value.trim())
  .filter(Boolean)
  .filter((value, index, all) => all.indexOf(value) === index);

// Fail fast at build/start if the server-side API proxy target is misconfigured.
getCustomerServerApiBase();

const envDistDir = process.env.NEXT_DIST_DIR?.trim();
const isProductionRuntime = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
const configDir = path.dirname(fileURLToPath(import.meta.url));

const securityHeaders: { key: string; value: string }[] = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), payment=()',
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
  experimental: {
    // Caps how many CPU cores `next build`'s webpack/SWC workers use. Default
    // (unset) is most/all host cores, which on a shared deploy host competes
    // with already-running containers and spikes CPU during deploys. Override
    // with NEXT_BUILD_CPUS if the build host has more headroom to spare.
    cpus: Number(process.env.NEXT_BUILD_CPUS) || 2,
  },
  // Let the edge reverse proxy handle compression — avoids double-compression 500s
  // and ERR_HTTP_HEADERS_SENT when Next and the proxy both gzip the same response.
  compress: false,
  compiler: {
    // Smaller client bundles in production; keep error/warn for debugging.
    removeConsole: isProductionRuntime ? { exclude: ['error', 'warn'] } : false,
  },
  // Next dev can intermittently miss generated manifests with custom distDir.
  // Keep default `.next` for development and allow overrides for non-dev runs.
  distDir: isProductionRuntime ? envDistDir || '.next' : '.next',
  // Avoid monorepo root inference when multiple lockfiles are present in production.
  outputFileTracingRoot: configDir,
  allowedDevOrigins,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  images: {
    qualities: [75, 95],
    remotePatterns: [
      // Unsplash — used for tour cover images on the invite page
      { protocol: 'https', hostname: 'images.unsplash.com' }
    ]
  }
};

export default withOptionalSentry(nextConfig);

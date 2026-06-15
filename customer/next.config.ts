import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

/** Used only for server-side rewrites; must be an absolute origin (see error below). */
const rawApiTarget = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL;

function ensureNestApiRewriteBase(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  try {
    const u = new URL(trimmed);
    const pathOnly = (u.pathname.replace(/\/$/, '') || '/') as string;
    if (pathOnly === '/') {
      return `${u.origin}/api`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

const apiProxyTarget = rawApiTarget ? ensureNestApiRewriteBase(rawApiTarget) : undefined;
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
    // KYC selfie capture needs camera on this origin; keep mic/geo/payment disabled.
    value: 'camera=(self), microphone=(), geolocation=(), payment=()',
  },
];

if (isProductionRuntime) {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  });
}

if (!apiProxyTarget) {
  throw new Error('Missing API_SERVER_URL or NEXT_PUBLIC_API_URL in customer environment.');
}

if (!/^https?:\/\//i.test(apiProxyTarget)) {
  throw new Error(
    'Customer app rewrites need an absolute API URL. Set API_SERVER_URL=http://localhost:4001/api ' +
      '(host dev) or API_SERVER_URL=http://backend:4001/api (Docker). ' +
      'Using only NEXT_PUBLIC_API_URL=/api breaks proxying and causes 500s on /api/*.'
  );
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/:path*`
      }
    ];
  },
  images: {
    remotePatterns: [
      // Unsplash — used for tour cover images on the invite page
      { protocol: 'https', hostname: 'images.unsplash.com' }
    ]
  }
};

export default nextConfig;

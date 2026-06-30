import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const envDistDir = process.env.NEXT_DIST_DIR?.trim();
const isProductionRuntime = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const securityHeaders: { key: string; value: string }[] = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // Developer selfie face-check tool needs camera on this origin.
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
};

export default nextConfig;

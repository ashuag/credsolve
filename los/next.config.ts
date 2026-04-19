import type { NextConfig } from 'next';

const distDir = process.env.NEXT_DIST_DIR?.trim();
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
  poweredByHeader: false,
  compiler: {
    removeConsole: isProductionRuntime ? { exclude: ['error', 'warn'] } : false,
  },
  allowedDevOrigins,
  ...(distDir ? { distDir } : {}),
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

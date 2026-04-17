import type { NextConfig } from 'next';

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const apiProxyTarget = (process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL)?.replace(/\/$/, '');
const authProxyTarget = apiProxyTarget?.replace(/\/api$/, '');
const envDistDir = process.env.NEXT_DIST_DIR?.trim();
const isProductionRuntime = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';

if (!apiProxyTarget) {
  throw new Error('Missing API_SERVER_URL or NEXT_PUBLIC_API_URL in customer environment.');
}

const nextConfig: NextConfig = {
  // Next dev can intermittently miss generated manifests with custom distDir.
  // Keep default `.next` for development and allow overrides for non-dev runs.
  distDir: isProductionRuntime ? envDistDir || '.next' : '.next',
  allowedDevOrigins,
  async rewrites() {
    return [
      {
        source: '/auth/google/login',
        destination: `${authProxyTarget}/auth/google/login`
      },
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

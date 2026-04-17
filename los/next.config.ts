import type { NextConfig } from 'next';

const distDir = process.env.NEXT_DIST_DIR?.trim();

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  ...(distDir ? { distDir } : {}),
};

export default nextConfig;

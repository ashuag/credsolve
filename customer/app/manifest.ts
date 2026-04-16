import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MoneyCash',
    short_name: 'MoneyCash',
    description: 'Instant digital loans — secure OTP login, account access, and loan journey.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffdf8',
    theme_color: '#12244f',
    orientation: 'portrait',
    categories: ['finance'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}

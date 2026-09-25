import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'brand-blue': '#22C55E',
        'brand-navy': '#0F2748',
        'brand-gold': '#22C55E',
        'brand-gold-deep': '#16A34A',
        'brand-text': '#0F2748',
        'brand-muted': '#5e6782',
        'brand-success': '#16A34A',
        'brand-warning': '#16A34A',
        'brand-danger': '#e75f5f'
      },
      screens: {
        nav: '920px',
        crm: '1120px',
        sidebar: '960px'
      },
      boxShadow: {
        'los-lg': '0 30px 70px rgba(23,44,113,0.14)',
        'los-md': '0 18px 40px rgba(23,44,113,0.1)'
      }
    }
  },
  plugins: []
};

export default config;

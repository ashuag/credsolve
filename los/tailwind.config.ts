import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'brand-blue': '#1496f3',
        'brand-navy': '#172c71',
        'brand-gold': '#ffc519',
        'brand-gold-deep': '#f0af00',
        'brand-text': '#12244f',
        'brand-muted': '#5e6782',
        'brand-success': '#1d9d70',
        'brand-warning': '#f7b500',
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

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        'brand-blue': '#1496f3',
        'brand-navy': '#172c71',
        'brand-gold': '#ffc519',
        'brand-gold-deep': '#f0af00',
        'brand-text': '#12244f',
        'brand-muted': '#5e6782'
      },
      screens: {
        nav: '920px'
      },
      animation: {
        'spin-btn': 'spin 800ms linear infinite',
        'mobile-border-pulse': 'mobileBorderPulse 1.7s ease-in-out infinite',
        'otp-border-pulse': 'otpBorderPulse 1.6s ease-in-out infinite',
        'account-border-pulse': 'accountBorderPulse 1.7s ease-in-out infinite',
        'calendar-in': 'calendarPopoverIn 220ms cubic-bezier(0.22,1,0.36,1) both',
        orbit: 'rotateOrbit 10s linear infinite',
        'orbit-rev': 'rotateReverse 8s linear infinite',
        'pulse-ring': 'pulseRing 2.4s ease-in-out infinite',
        'core-pulse': 'corePulse 1.8s ease-in-out infinite',
        'orbit-1': 'orbitOne 3s linear infinite',
        'orbit-2': 'orbitTwo 3.8s linear infinite',
        'orbit-3': 'orbitThree 4.4s linear infinite',
        'loader-bar': 'loaderBar 1.6s ease-in-out infinite',
        'scan-beam': 'rotateOrbit 4.4s linear infinite',
        sheen: 'sheenPass 3.2s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.8s ease-in-out infinite',
        'loader-bar-shift': 'loaderBarShift 2s linear infinite'
      }
    }
  },
  plugins: []
};

export default config;

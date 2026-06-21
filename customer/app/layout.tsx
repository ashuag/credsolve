import './globals.css';
import type {Metadata, Viewport} from 'next';
import {Inter} from 'next/font/google';
import {ReactNode} from 'react';
import {CustomerUtmBootstrap} from '@/components/auth/customer-utm-bootstrap';
import { LayoutWrapper } from '@/components/layout/LayoutWrapper';
import {CustomerSessionProvider} from '@/components/providers/customer-session-provider';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
    adjustFontFallback: true,
});

export const metadata: Metadata = {
    title: {
        default: 'Get Instant Loan Up to ₹50,000 | MoneyCash',
        template: '%s | MoneyCash'
    },
    description: 'MoneyCash customer portal for secure OTP login, account access, payments, and loan application progress.',
    icons: {
        icon: '/icons/icon-192.png',
        shortcut: '/icons/icon-192.png',
        apple: '/icons/apple-touch-icon.png',
    },
    appleWebApp: {
        capable: true,
        title: 'MoneyCash',
        statusBarStyle: 'black-translucent',
    },
    openGraph: {
        title: 'MoneyCash Customer Portal',
        description: 'MoneyCash customer portal for secure OTP login, account access, payments, and loan application progress.',
        type: 'website',
        siteName: 'MoneyCash'
    }
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#1C347D',
};

export default function RootLayout({children}: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="en" className={inter.variable}>
        <body suppressHydrationWarning>
            <CustomerSessionProvider>
                <CustomerUtmBootstrap/>
                <LayoutWrapper>
                    {children}
                </LayoutWrapper>
            </CustomerSessionProvider>
        </body>
        </html>
    );
}

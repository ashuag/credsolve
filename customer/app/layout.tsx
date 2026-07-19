import './globals.css';
import type {Metadata, Viewport} from 'next';
import {Inter} from 'next/font/google';
import {ReactNode} from 'react';
import {CustomerUtmBootstrap} from '@/components/auth/customer-utm-bootstrap';
import { LayoutWrapper } from '@/components/layout/LayoutWrapper';
import {CustomerSessionProvider} from '@/components/providers/customer-session-provider';
import { MAX_LOAN_DISPLAY } from '@/lib/brand';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
    adjustFontFallback: true,
});

export const metadata: Metadata = {
    title: {
        default: `Get Instant Loan Up to ${MAX_LOAN_DISPLAY} | MoneyCash`,
        template: '%s | MoneyCash'
    },
    description: 'MoneyCash customer portal for secure OTP login, account access, payments, and loan application progress.',
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
            { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
            { url: '/icons/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
            { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        ],
        shortcut: '/favicon.ico',
        apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
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

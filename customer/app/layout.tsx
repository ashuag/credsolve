import './globals.css';
import type {Metadata, Viewport} from 'next';
import {Inter} from 'next/font/google';
import {ReactNode} from 'react';
import {CustomerUtmBootstrap} from '@/components/auth/customer-utm-bootstrap';
import {BrandHeader} from '@/components/layout/brand-header';
import {CustomerSessionProvider} from '@/components/providers/customer-session-provider';
import {MobileTabBar} from '@/components/layout/mobile-tab-bar';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    weight: ['400', '600', '700', '800'],
    variable: '--font-inter',
    adjustFontFallback: true,
});

export const metadata: Metadata = {
    title: {
        default: 'MoneyCash Customer Portal',
        template: '%s | MoneyCash'
    },
    description: 'MoneyCash customer portal for secure OTP login, account access, payments, and loan application progress.',
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
    themeColor: '#12244f',
};

export default function RootLayout({children}: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="en" className={`${inter.variable} ${inter.className}`}>
        <head>
            <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"/>
            <title>Get Instant Loan Upto 50,000</title>
        </head>
        <body suppressHydrationWarning>
        <CustomerSessionProvider>
        <CustomerUtmBootstrap/>
        <BrandHeader/>
        <div
            className="w-[min(1180px,calc(100%-24px))] mx-auto pb-12 max-sm:w-[min(calc(100%-18px),520px)] max-sm:pb-[calc(76px+env(safe-area-inset-bottom))]">
            <main className="grid gap-5.5 pt-5.5 max-sm:pt-4.5">{children}</main>
        </div>
        <MobileTabBar/>
        </CustomerSessionProvider>
        </body>
        </html>
    );
}

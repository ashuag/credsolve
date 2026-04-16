import './globals.css';
import type {Metadata, Viewport} from 'next';
import {ReactNode} from 'react';
import {CustomerSessionBootstrap} from '@/components/auth/customer-session-bootstrap';
import {CustomerUtmBootstrap} from '@/components/auth/customer-utm-bootstrap';
import {BrandHeader} from '@/components/layout/brand-header';
import {MobileTabBar} from '@/components/layout/mobile-tab-bar';

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
        <html lang="en">
        <head>
            <link rel="preconnect" href="https://fonts.googleapis.com"/>
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
            <link
                href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
                rel="stylesheet"
            />
            <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"/>
            <title>Get Instant Loan Upto 50,000</title>
        </head>
        <body suppressHydrationWarning>
        <CustomerSessionBootstrap/>
        <CustomerUtmBootstrap/>
        <BrandHeader/>
        <div
            className="w-[min(1180px,calc(100%-24px))] mx-auto pb-12 max-sm:w-[min(calc(100%-18px),520px)] max-sm:pb-[calc(76px+env(safe-area-inset-bottom))]">
            <main className="grid gap-5.5 pt-5.5 max-sm:pt-4.5">{children}</main>
        </div>
        <MobileTabBar/>
        </body>
        </html>
    );
}

import './globals.css';
import type {Metadata, Viewport} from 'next';
import localFont from 'next/font/local';
import { Caveat } from 'next/font/google';
import {ReactNode} from 'react';
import {CustomerUtmBootstrap} from '@/components/auth/customer-utm-bootstrap';
import { LayoutWrapper } from '@/components/layout/LayoutWrapper';
import {CustomerSessionProvider} from '@/components/providers/customer-session-provider';
import {RejectedLeadSessionGate} from '@/components/auth/rejected-lead-session-gate';
import { MAX_LOAN_DISPLAY } from '@/lib/brand';

const poppins = localFont({
    src: [
        { path: './fonts/Poppins-Regular.ttf', weight: '400', style: 'normal' },
        { path: './fonts/Poppins-Medium.ttf', weight: '500', style: 'normal' },
        { path: './fonts/Poppins-SemiBold.ttf', weight: '600', style: 'normal' },
        { path: './fonts/Poppins-Bold.ttf', weight: '700', style: 'normal' },
        { path: './fonts/Poppins-ExtraBold.ttf', weight: '800', style: 'normal' },
        { path: './fonts/Poppins-Black.ttf', weight: '900', style: 'normal' },
    ],
    display: 'swap',
    variable: '--font-poppins',
    adjustFontFallback: 'Arial',
});

const caveat = Caveat({
    subsets: ['latin'],
    weight: ['600', '700'],
    variable: '--font-caveat',
    display: 'swap',
});

export const metadata: Metadata = {
    title: {
        default: `Credit Made Easy — Instant Loans up to ${MAX_LOAN_DISPLAY} | CredSolve`,
        template: '%s | CredSolve'
    },
    description: 'CredSolve — instant personal loans with RBI-registered NBFC partners. Apply with PAN & get a decision in minutes. 100% paperless. No charges before disbursal.',
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
        title: 'CredSolve',
        statusBarStyle: 'black-translucent',
    },
    openGraph: {
        title: 'CredSolve | Credit Made Easy',
        description: 'Instant personal loans with RBI-registered NBFC partners. Apply with PAN & get a decision in minutes.',
        type: 'website',
        siteName: 'CredSolve'
    }
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#0F2748',
};

export default function RootLayout({children}: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="en" className={`${poppins.variable} ${caveat.variable}`}>
        <body suppressHydrationWarning>
            <CustomerSessionProvider>
                <CustomerUtmBootstrap/>
                <RejectedLeadSessionGate>
                    <LayoutWrapper>
                        {children}
                    </LayoutWrapper>
                </RejectedLeadSessionGate>
            </CustomerSessionProvider>
        </body>
        </html>
    );
}

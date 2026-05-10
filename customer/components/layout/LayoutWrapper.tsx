'use client';

import { usePathname } from 'next/navigation';
import { ReactNode, Suspense } from 'react';
import { BrandHeader } from '@/components/layout/brand-header';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';

export function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';
  const isApplyPage = pathname === '/apply-for-loan';
  const isAccountLoginPage = pathname === '/my-account';

  if (isLandingPage || isApplyPage || isAccountLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Suspense
        fallback={
          <header
            className="sticky top-0 z-20 min-h-[72px] border-b border-b-[rgba(18,36,79,0.09)] bg-[rgba(255,253,248,0.95)] backdrop-blur-[24px] shadow-[0_4px_32px_rgba(23,44,113,0.08)]"
            aria-hidden
          />
        }
      >
        <BrandHeader />
      </Suspense>
      <div className="w-[min(1180px,calc(100%-24px))] mx-auto pb-12 max-sm:w-[min(calc(100%-18px),520px)] max-sm:pb-[calc(76px+env(safe-area-inset-bottom))]">
        <main className="grid gap-5.5 pt-5.5 max-sm:pt-4.5">{children}</main>
      </div>
      <MobileTabBar />
    </>
  );
}

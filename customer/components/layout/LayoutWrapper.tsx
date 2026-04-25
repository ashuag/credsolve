'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { BrandHeader } from '@/components/layout/brand-header';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';

export function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  if (isLandingPage) {
    return <>{children}</>;
  }

  return (
    <>
      <BrandHeader />
      <div className="w-[min(1180px,calc(100%-24px))] mx-auto pb-12 max-sm:w-[min(calc(100%-18px),520px)] max-sm:pb-[calc(76px+env(safe-area-inset-bottom))]">
        <main className="grid gap-5.5 pt-5.5 max-sm:pt-4.5">{children}</main>
      </div>
      <MobileTabBar />
    </>
  );
}

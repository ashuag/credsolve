import { Suspense, type ReactNode } from 'react';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';

type LegalPageShellProps = {
  children: ReactNode;
  /**
   * Retained for backward compatibility with existing call sites. The shared
   * landing header no longer renders a per-page label, so this is unused.
   */
  pageLabel?: string;
};

export function LegalPageShell({ children }: LegalPageShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#f7f9fc]">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(20,150,243,0.14),transparent_68%)]" />
        <div className="absolute -right-20 top-32 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.16),transparent_70%)]" />
      </div>

      <Suspense
        fallback={
          <header
            className="sticky top-0 z-50 min-h-[112px] w-full border-b border-[#12244f]/8 bg-white"
            aria-hidden
          />
        }
      >
        <LandingNavbar />
      </Suspense>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-10">
        {children}
      </main>

      <Suspense fallback={null}>
        <LandingFooter />
      </Suspense>
    </div>
  );
}

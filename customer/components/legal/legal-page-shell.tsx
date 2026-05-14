import Link from 'next/link';
import type { ReactNode } from 'react';

type LegalPageShellProps = {
  children: ReactNode;
  variant: 'terms' | 'privacy';
};

export function LegalPageShell({ children, variant }: LegalPageShellProps) {
  const sisterHref = variant === 'terms' ? '/privacy-policy' : '/terms-and-conditions';
  const sisterLabel = variant === 'terms' ? 'Privacy' : 'Terms';

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      >
        <div className="absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(20,150,243,0.18),transparent_68%)]" />
        <div className="absolute -right-20 top-32 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.22),transparent_70%)]" />
        <div className="absolute bottom-0 left-1/2 h-[min(50vh,420px)] w-[min(96vw,900px)] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse_at_center,rgba(23,44,113,0.06),transparent_70%)]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-[rgba(18,36,79,0.08)] bg-[rgba(255,253,248,0.88)] backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-[1.05rem] font-black tracking-tight text-brand-navy transition hover:text-brand-blue"
          >
            Money<span className="text-brand-blue">Cash</span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Link
              href="/apply-for-loan"
              className="rounded-full border border-[rgba(18,36,79,0.1)] bg-white/90 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-brand-navy shadow-sm transition hover:border-brand-blue/30 hover:text-brand-blue sm:px-4"
            >
              Apply
            </Link>
            <Link
              href={sisterHref}
              className="rounded-full border border-transparent px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-brand-muted transition hover:bg-white/80 hover:text-brand-navy sm:px-4"
            >
              {sisterLabel}
            </Link>
            <Link
              href="/"
              className="rounded-full bg-gradient-to-r from-[#1496f3] to-[#0d7dd8] px-3.5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-[0_8px_20px_rgba(20,150,243,0.35)] transition hover:opacity-95 sm:px-4"
            >
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-12">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-px rounded-[30px] bg-gradient-to-br from-[rgba(20,150,243,0.12)] via-transparent to-[rgba(255,197,25,0.12)] opacity-90" aria-hidden />
          <div className="relative overflow-hidden rounded-[28px] border border-[rgba(18,36,79,0.1)] bg-gradient-to-b from-white/[0.97] to-[rgba(255,255,255,0.9)] px-5 py-8 shadow-[0_24px_48px_rgba(23,44,113,0.08)] sm:rounded-[32px] sm:px-8 sm:py-10 md:px-10 md:py-12">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

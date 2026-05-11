'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {buildHrefWithSearch} from '@/lib/navigation';
import {CountUp} from '@/components/ui/count-up';
import {HomeCalculator} from '@/components/landing/HomeCalculator';

export function HeroSection() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);

  return (
    <section className="relative overflow-hidden bg-white">
      {/* Light sophisticated top glow matching logo color */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[800px] bg-[radial-gradient(ellipse_at_top,_rgba(20,150,243,0.08)_0%,_transparent_70%)] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#1496f3]/5 to-transparent pointer-events-none" />
      
      {/* Grid mesh overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(20,150,243,1) 1px, transparent 1px), linear-gradient(90deg, rgba(20,150,243,1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* Animated blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -right-32 h-[600px] w-[600px] rounded-full bg-[#1496f3]/12 blur-[120px] animate-blob"
          style={{ animationDuration: '7s' }}
        />
        <div
          className="absolute -bottom-24 -left-24 h-[500px] w-[500px] rounded-full bg-[#ffc519]/8 blur-[100px] animate-blob animation-delay-2000"
          style={{ animationDuration: '9s' }}
        />
        <div
          className="absolute top-1/2 left-1/3 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-[#1c347d]/18 blur-[80px] animate-blob animation-delay-4000"
          style={{ animationDuration: '11s' }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-h-[90vh] items-center gap-12 py-16 lg:grid-cols-2 lg:gap-20 lg:py-0">

          {/* ── Left: Content ── */}
          <div className="flex flex-col gap-8">
            {/* Live badge */}
            <div className="flex items-center gap-3 animate-fade-in-up">
              <div className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-600" />
              </div>
              <span className="text-[0.7rem] font-[900] uppercase tracking-[0.22em] text-[#64748b]">
                RBI Registered NBFC &bull; Trusted by 50,000+ Customers
              </span>
            </div>

            {/* Headline */}
            <div className="animate-fade-in-up flex flex-col gap-5" style={{ animationDelay: '80ms' }}>
              <h1 className="flex flex-col font-[900] tracking-tight">
                <span className="text-[clamp(1.8rem,3.5vw,2.5rem)] leading-[1.2] text-[#0f172a] drop-shadow-sm">
                  Fast Loans up to
                </span>
                <span className="text-[clamp(4.5rem,9vw,7.5rem)] leading-[1.02] text-transparent bg-clip-text bg-gradient-to-br from-[#1fa2ff] to-[#1496f3] drop-shadow-[0_0_24px_rgba(20,150,243,0.15)] my-1">
                  ₹50,000
                </span>
                <span className="text-[clamp(1.8rem,3.5vw,2.5rem)] leading-[1.2] text-[#0f172a] drop-shadow-sm">
                  Direct to Your Bank.
                </span>
              </h1>
              <p className="max-w-xl text-[1.1rem] md:text-[1.2rem] font-[500] leading-relaxed text-[#475569]">
                100% digital &bull; zero paperwork &bull; instant disbursal.
                <br className="hidden sm:block" />
                Get approved in <span className="font-[800] text-[#0f172a]">2 minutes</span> and money in your account in{' '}
                <span className="font-[800] text-[#0f172a]">10 minutes</span>.
              </p>
            </div>

            {/* Trust chips */}
            <div className="flex animate-fade-in-up flex-wrap gap-2.5" style={{ animationDelay: '160ms' }}>
              {[
                { icon: (
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="currentColor">
                    <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                  </svg>
                ), label: 'No Hidden Charges' },
                { icon: (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#f59e0b]" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                ), label: 'Instant Approval' },
                { icon: (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#1496f3]" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="5" y="11" width="14" height="11" rx="2" strokeLinecap="round"/>
                    <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round"/>
                  </svg>
                ), label: 'PAN & Aadhaar Only' },
              ].map((chip) => (
                <div
                  key={chip.label}
                  className="flex items-center gap-2 rounded-full border border-[#1496f3]/15 bg-white px-4 py-2.5 text-[0.78rem] font-[800] tracking-wide text-[#334155] shadow-[0_4px_16px_rgba(20,150,243,0.06)] transition-all duration-300 hover:bg-[#f8fafc] hover:border-[#1496f3]/30 hover:-translate-y-0.5"
                >
                  {chip.icon}
                  {chip.label}
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div
              className="flex animate-fade-in-up flex-col gap-4 sm:flex-row sm:items-center mt-2"
              style={{ animationDelay: '240ms' }}
            >
              <Link
                href={applyHref}
                className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-[#ffc519] to-[#ffaa00] px-12 py-5 text-[1.1rem] font-[900] text-[#0a1628] shadow-[0_8px_32px_rgba(255,197,25,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(255,197,25,0.5)] hover:from-[#ffd040] hover:to-[#ffbb00]"
              >
                Apply Now
                <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5" fill="currentColor">
                  <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
                </svg>
                {/* Sheen effect */}
                <span className="absolute inset-0 overflow-hidden rounded-full">
                  <span className="absolute -left-[150%] top-0 h-full w-[150%] -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-all duration-700 ease-in-out group-hover:left-[150%]" />
                </span>
              </Link>
            </div>

            {/* Animated stats */}
            <div
              className="animate-fade-in-up grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-200 pt-8 min-[560px]:grid-cols-4"
              style={{ animationDelay: '320ms' }}
            >
              {[
                { label: 'Happy Customers', to: 50000, prefix: '', suffix: '+' },
                { label: 'Total Disbursed', to: 500, prefix: '₹', suffix: 'Cr+' },
                { label: 'Approval Time', to: 2, prefix: '', suffix: ' Min' },
                { label: 'Approval Rate', to: 98, prefix: '', suffix: '%' },
              ].map((s, i) => (
                <div key={i} className="min-w-0 flex flex-col gap-1">
                  <div className="text-[clamp(1.7rem,3vw,1.9rem)] font-[900] tabular-nums text-[#0f172a]">
                    <CountUp to={s.to} prefix={s.prefix} suffix={s.suffix} />
                  </div>
                  <div className="text-[0.62rem] font-[800] uppercase tracking-[0.18em] text-[#64748b]">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Illustration ── */}
          <HomeCalculator />
        </div>

        {/* Trust strip */}
        <div className="border-t border-slate-200 py-5">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
            {[
              { label: 'RBI Registered NBFC', path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
              { label: 'Bank-Grade Security', path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
              { label: '100% Paperless Process', path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
              { label: 'Trusted by 50,000+', path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[#64748b]">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={item.path} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[0.68rem] font-[700] uppercase tracking-[0.14em]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

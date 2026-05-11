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
    <section className="relative overflow-hidden bg-[#f4f8fc]">
      {/* === Background layer === */}
      {/* Soft radial horizon */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(20,150,243,0.16),transparent_55%)]"
        aria-hidden
      />
      {/* Right amber glow */}
      <div
        className="pointer-events-none absolute -right-[20%] top-1/4 h-[min(70vw,520px)] w-[min(70vw,520px)] rounded-full bg-[#ffc519]/12 blur-[120px]"
        aria-hidden
      />
      {/* Left blue shimmer */}
      <div
        className="pointer-events-none absolute -left-[15%] bottom-0 h-[min(55vw,420px)] w-[min(55vw,420px)] rounded-full bg-[#1496f3]/10 blur-[100px]"
        aria-hidden
      />
      {/* Subtle dot-grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.022]"
        style={{backgroundImage: 'radial-gradient(#12244f 1px, transparent 1px)', backgroundSize: '28px 28px'}}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
        <div className="grid min-h-[auto] items-center gap-8 py-10 sm:py-12 lg:min-h-[min(88svh,900px)] lg:grid-cols-[1fr_520px] lg:gap-12 lg:py-16 xl:grid-cols-[1fr_600px] xl:gap-14 2xl:grid-cols-[1fr_640px]">

          {/* ── Copy column ── */}
          <div className="flex max-w-xl flex-col gap-5 lg:gap-7 lg:max-w-none xl:pr-4">

            {/* Trust badge */}
            <div className="flex flex-wrap items-center gap-3 animate-fade-in-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#1496f3]/20 bg-white/95 px-4 py-2 text-[0.65rem] font-[900] uppercase tracking-[0.2em] text-[#1c347d] shadow-[0_4px_20px_rgba(20,150,243,0.1)] backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                RBI NBFC · 50,000+ served
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ffc519]/25 bg-[#ffc519]/8 px-4 py-2 text-[0.65rem] font-[900] uppercase tracking-[0.2em] text-[#b45309] shadow-sm backdrop-blur-sm">
                ⚡ Instant Approval
              </span>
            </div>

            {/* Headline */}
            <div className="animate-fade-in-up space-y-4" style={{animationDelay: '60ms'}}>
              <h1 className="font-[900] tracking-tight text-[#0c1929]">
                <span className="block text-[clamp(0.95rem,2vw,1.2rem)] font-[800] uppercase tracking-[0.3em] text-[#64748b]">
                  Instant digital loan
                </span>
                <span className="mt-2 block text-[clamp(2rem,5.4vw,4rem)] leading-[1.06]">
                  Up to{' '}
                  <span className="relative inline-block">
                    <span className="bg-[linear-gradient(135deg,#1fa2ff_0%,#1496f3_45%,#1c347d_100%)] bg-clip-text text-transparent">
                      ₹50,000
                    </span>
                    {/* Underline accent */}
                    <span className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-[#1496f3]/60 to-[#1fa2ff]/20" />
                  </span>
                  <br />
                  in your bank today.
                </span>
              </h1>
              <p className="max-w-lg text-[1.05rem] font-[600] leading-relaxed text-[#475569] md:text-[1.12rem]">
                Paperless with PAN &amp; Aadhaar. Typical approval in{' '}
                <strong className="font-[900] text-[#0c1929]">2 minutes</strong>, disbursal in{' '}
                <strong className="font-[900] text-[#0c1929]">about 10 minutes</strong>.
              </p>
            </div>

            {/* Trust pills */}
            <ul className="animate-fade-in-up flex flex-wrap gap-1.5 sm:gap-2" style={{animationDelay: '120ms'}}>
              {['No hidden charges', 'Instant decision', '256-bit security', '0% processing fee'].map((label) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-[0.68rem] font-[800] text-[#334155] shadow-[0_2px_12px_rgba(18,36,79,0.06)] backdrop-blur-sm sm:px-3.5 sm:py-2 sm:text-[0.72rem]"
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0 text-emerald-500" fill="currentColor" aria-hidden>
                    <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
                  </svg>
                  {label}
                </li>
              ))}
            </ul>

            {/* CTA buttons */}
            <div className="animate-fade-in-up flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center" style={{animationDelay: '180ms'}}>
              <Link
                href={applyHref}
                className="group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#ffc519] to-[#f5a623] px-10 py-4 text-[1.05rem] font-[900] text-[#0a1628] shadow-[0_12px_40px_rgba(245,166,35,0.4)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_56px_rgba(245,166,35,0.5)] active:scale-[0.98]"
              >
                Apply Now — It's Free
                <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="currentColor" aria-hidden>
                  <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
                </svg>
                {/* Sheen sweep */}
                <span className="absolute inset-0 overflow-hidden rounded-2xl">
                  <span className="absolute -left-full top-0 h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-all duration-700 group-hover:left-full" />
                </span>
              </Link>
              <Link
                href="#testimonials"
                className="group inline-flex items-center justify-center gap-2 text-center text-[0.95rem] font-[800] text-[#1496f3] underline decoration-[#1496f3]/30 decoration-2 underline-offset-4 transition-all hover:text-[#1c347d] hover:decoration-[#1c347d]/40 sm:text-left"
              >
                Read borrower stories
                <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="currentColor" aria-hidden>
                  <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
                </svg>
              </Link>
            </div>

            {/* Stats strip */}
            <dl
              className="animate-fade-in-up grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[#0c1929]/8 pt-5 sm:grid-cols-4 sm:gap-x-6 sm:gap-y-5 sm:pt-7"
              style={{animationDelay: '240ms'}}
            >
              {[
                {label: 'Happy customers', to: 50000, prefix: '', suffix: '+'},
                {label: 'Disbursed', to: 500, prefix: '₹', suffix: 'Cr+'},
                {label: 'Avg. approval', to: 2, prefix: '', suffix: ' min'},
                {label: 'Approval rate', to: 98, prefix: '', suffix: '%'},
              ].map((s) => (
                <div key={s.label} className="group min-w-0">
                  <dt className="text-[0.57rem] font-[800] uppercase tracking-[0.18em] text-[#64748b]">{s.label}</dt>
                  <dd className="mt-1 text-[clamp(1.4rem,3vw,1.75rem)] font-[900] tabular-nums text-[#0c1929] transition-transform group-hover:scale-[1.04]">
                    <CountUp to={s.to} prefix={s.prefix} suffix={s.suffix} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ── Calculator card column (wider track + full-width card) ── */}
          <div
            className="relative w-full min-w-0 animate-fade-in-up lg:justify-self-stretch"
            style={{animationDelay: '100ms'}}
          >
            {/* Outer glow halo */}
            <div
              className="absolute -inset-4 rounded-[44px] bg-gradient-to-br from-[#1496f3]/14 via-transparent to-[#ffc519]/12 blur-2xl lg:-inset-6"
              aria-hidden
            />

            <div className="relative">
              <HomeCalculator embed />
            </div>
          </div>
        </div>

        {/* ── Trust strip ── */}
        <div className="border-t border-[#0c1929]/6 pb-8 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:gap-x-14">
            {[
              {label: 'RBI registered NBFC', path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'},
              {label: 'Bank-grade security', path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'},
              {label: '100% paperless', path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'},
              {label: 'Trusted nationwide', path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'},
            ].map((item) => (
              <div key={item.label} className="group flex items-center gap-2 text-[#64748b] transition-colors hover:text-[#1496f3]">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#1496f3] transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d={item.path} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[0.65rem] font-[800] uppercase tracking-[0.12em]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

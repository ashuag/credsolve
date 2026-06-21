'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { HomeCalculator } from '@/components/landing/HomeCalculator';
import { BRAND_TAGLINE, BRAND_TRUST_STRIP, BRAND_VALUE_PILLS, MAX_LOAN_DISPLAY } from '@/lib/brand';

export function HeroSection() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);

  return (
    <section className="relative overflow-hidden bg-[#f4f8fc]">
      {/* === Background layer (from kyc_process) === */}
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
        style={{ backgroundImage: 'radial-gradient(#12244f 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-stretch gap-6 py-10 sm:py-12 lg:min-h-[min(88svh,880px)] lg:grid-cols-[1fr_440px] lg:gap-8 lg:py-14 xl:grid-cols-[1fr_480px] xl:gap-10">

          {/* Copy panel — Clean light typography */}
          <div className="relative flex flex-col justify-center py-6 sm:py-8 lg:py-10 xl:py-12">
            {/* Badges */}
            <div className="mb-6 flex flex-wrap items-center gap-2.5 animate-fade-in-up">
              <span className="inline-flex items-center rounded-full border border-[#10b981]/15 bg-white/70 px-3.5 py-1.5 text-[0.6rem] font-[900] uppercase tracking-[0.18em] text-[#059669] shadow-[0_4px_16px_rgba(16,185,129,0.08)] backdrop-blur-sm">
                <span className="relative mr-2 flex h-1.5 w-1.5" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10b981] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10b981]" />
                </span>
                {BRAND_TAGLINE}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/8 px-3.5 py-1.5 text-[0.6rem] font-[900] uppercase tracking-[0.18em] text-[#e5a800] shadow-[0_4px_16px_rgba(245,158,11,0.08)] backdrop-blur-sm">
                ⚡ Instant Approval
              </span>
            </div>

            {/* Headline */}
            <div className="animate-fade-in-up space-y-4" style={{ animationDelay: '60ms' }}>
              <p className="text-[0.72rem] font-[800] uppercase tracking-[0.22em] text-[#12244f]/60">
                Instant digital loan
              </p>
              <h1 className="text-[clamp(2.2rem,5vw,3.8rem)] font-[900] leading-[1.08] tracking-tight text-[#12244f]">
                Up to{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 bg-gradient-to-r from-[#1496f3] to-[#2388e5] bg-clip-text text-transparent">{MAX_LOAN_DISPLAY}</span>
                  <span
                    className="absolute -inset-x-1.5 bottom-1 z-0 h-3 -skew-x-6 rounded bg-gradient-to-r from-[#1496f3]/25 via-[#2388e5]/15 to-transparent"
                    aria-hidden
                  />
                </span>{' '}
                in your bank today.
              </h1>
              <p className="max-w-md text-[1rem] font-[600] leading-relaxed text-[#12244f]/70 md:text-[1.05rem]">
                Paperless with PAN &amp; Aadhaar. Typical approval in{' '}
                <strong className="font-[900] text-[#12244f]">2 minutes</strong>, disbursal in{' '}
                <strong className="font-[900] text-[#12244f]">about 10 minutes</strong>.
              </p>
            </div>

            {/* Value grid */}
            <ul
              className="animate-fade-in-up mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5"
              style={{ animationDelay: '140ms' }}
            >
              {BRAND_VALUE_PILLS.map((label) => (
                <li
                  key={label}
                  className="group/pill flex items-center gap-2.5 rounded-xl border border-[#12244f]/8 bg-white/70 px-3.5 py-2.5 text-[0.78rem] font-[700] text-[#12244f]/85 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#10b981]/30 hover:bg-white hover:shadow-[0_8px_20px_rgba(16,185,129,0.08)]"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_2px_6px_rgba(16,185,129,0.25)] transition-transform group-hover/pill:scale-110">
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
                      <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
                    </svg>
                  </span>
                  {label}
                </li>
              ))}
            </ul>

            {/* CTA row */}
            <div
              className="animate-fade-in-up mt-8 flex flex-col gap-4 sm:flex-row sm:items-center"
              style={{ animationDelay: '180ms' }}
            >
              <Link
                href={applyHref}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#f4b400] to-[#e5a800] px-8 py-3.5 text-[0.95rem] font-[900] text-[#12244f] shadow-[0_12px_32px_rgba(244,180,0,0.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_44px_rgba(244,180,0,0.35)] active:scale-[0.98]"
              >
                Apply Now — It&apos;s Free
                <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="currentColor" aria-hidden>
                  <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
                </svg>
                {/* Sheen sweep */}
                <span className="absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
                  <span className="absolute -left-full top-0 h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-700 group-hover:left-full" />
                </span>
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-1 text-[0.92rem] font-[800] text-[#1496f3] transition-colors hover:text-[#2388e5] hover:underline"
              >
                Read borrower stories
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M4 8h8M9 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            {/* Social proof */}
            <div
              className="animate-fade-in-up mt-7 flex items-center gap-3.5"
              style={{ animationDelay: '200ms' }}
            >
              <div className="flex -space-x-2.5">
                {[
                  { initials: 'AR', from: '#1496f3', to: '#2388e5' },
                  { initials: 'SK', from: '#10b981', to: '#059669' },
                  { initials: 'PV', from: '#f4b400', to: '#e5a800' },
                  { initials: 'MJ', from: '#8b5cf6', to: '#6d28d9' },
                ].map((a) => (
                  <span
                    key={a.initials}
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[0.58rem] font-[900] text-white shadow-[0_2px_8px_rgba(18,36,79,0.12)]"
                    style={{ backgroundImage: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
                  >
                    {a.initials}
                  </span>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-0.5 text-[#f4b400]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <svg key={i} viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                      <path d="M9.05 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.367-2.447a1 1 0 00-1.176 0l-3.367 2.447c-.784.57-1.838-.196-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.075 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.951-.69l1.286-3.957z" />
                    </svg>
                  ))}
                </div>
                <span className="text-[0.72rem] font-[700] text-[#12244f]/65">
                  <strong className="font-[900] text-[#12244f]">4.9/5</strong> from 5,000+ happy customers
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div
              className="animate-fade-in-up mt-7 grid grid-cols-2 gap-4 border-t border-[#12244f]/8 pt-7 sm:grid-cols-4 sm:gap-6"
              style={{ animationDelay: '240ms' }}
            >
              {[
                { label: 'Happy Customers', value: '5,000+' },
                { label: 'Disbursed', value: '₹500Cr+' },
                { label: 'Avg. Approval', value: '2 min' },
                { label: 'Approval Rate', value: '98%' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <span className="text-[0.62rem] font-[800] uppercase tracking-[0.14em] text-[#12244f]/40">
                    {stat.label}
                  </span>
                  <span className="mt-1 text-2xl font-[900] text-brand-navy sm:text-3xl">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Calculator column */}
          <div
            className="relative flex min-w-0 items-center animate-fade-in-up lg:justify-self-stretch"
            style={{ animationDelay: '80ms' }}
          >
            {/* Glow halo */}
            <div
              className="absolute -inset-4 rounded-[40px] bg-gradient-to-br from-brand-blue/8 via-transparent to-brand-gold/6 blur-2xl lg:-inset-6"
              aria-hidden
            />
            <div className="relative w-full animate-float-slow">
              <HomeCalculator embed />
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="border-t border-[#12244f]/8 pb-8 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
            {BRAND_TRUST_STRIP.map((label, index) => (
              <div key={label} className="flex items-center gap-4">
                {index > 0 ? <span className="hidden text-[#12244f]/25 sm:inline" aria-hidden>·</span> : null}
                <span className="text-[0.68rem] font-[800] uppercase tracking-[0.14em] text-[#12244f]/45 sm:text-[0.72rem]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

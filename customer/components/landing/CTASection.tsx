'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { BRAND_TAGLINE } from '@/lib/brand';
import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';

export function CTASection() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const sectionRef = useScrollReveal();

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#0a1628] py-20 lg:py-28">
      {/* Animated blobs */}
      <div className="pointer-events-none absolute -top-28 -right-28 h-72 w-72 rounded-full bg-brand-gold/25 blur-[90px] animate-blob" />
      <div className="pointer-events-none absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-brand-blue/25 blur-[90px] animate-blob animation-delay-2000" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8b5cf6]/15 blur-[80px] animate-blob animation-delay-4000" />

      {/* Grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Gold accent top border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-70" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">

        {/* Pill badge */}
        <div className="reveal mb-8 inline-flex items-center gap-2.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-5 py-2.5 shadow-[0_4px_20px_rgba(244,180,0,0.15)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-gold" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="text-[0.65rem] font-[900] uppercase tracking-[0.24em] text-brand-gold">
            Get Money in Your Account Today
          </span>
        </div>

        {/* Headline */}
        <h2 className="reveal text-[clamp(1.9rem,5vw,3.8rem)] font-[900] leading-[1.1] tracking-tight text-white stagger-1">
          Don&apos;t Let Financial{' '}
          <span className="text-grad-gold">Emergencies</span>
          <br />
          Slow You Down.
        </h2>

        <p className="reveal mx-auto mt-6 max-w-xl text-[1.05rem] font-[600] leading-relaxed text-white/55 stagger-2">
          Apply in 30 seconds. Get approved in 2 minutes. Money in your account in under 10 minutes.
          {BRAND_TAGLINE}. Zero hidden charges.
        </p>

        {/* Benefit chips */}
        <div className="reveal mt-10 flex flex-wrap items-center justify-center gap-3 stagger-3">
          {[
            '✓ No branch visit',
            '✓ PAN & Aadhaar only',
            '✓ Instant approval',
            '✓ 0 hidden fees',
          ].map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/12 bg-white/6 px-5 py-2 text-sm font-[700] text-white/70 backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              {item}
            </span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="reveal mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center stagger-4">
          <Link
            href={applyHref}
            className="group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-brand-gold px-10 py-4 text-lg font-[900] text-[#0a1628] glow-gold transition-all active:scale-[0.97] sm:w-auto sm:px-12 sm:py-5 sm:text-xl"
          >
            Apply Now — It&apos;s Free
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="currentColor">
              <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
            </svg>
            {/* Sheen */}
            <span className="absolute inset-0 overflow-hidden rounded-2xl">
              <span className="absolute -left-full top-0 h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-sheen" />
            </span>
          </Link>

          <Link
            href={applyHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/6 px-8 py-4 text-sm font-[700] text-white/80 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/12 hover:text-white sm:w-auto sm:px-10 sm:py-5 sm:text-base"
          >
            Check Eligibility First
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        {/* Trust note */}
        <p className="reveal mt-8 text-xs font-[700] text-white/30 stagger-5">
          Checking eligibility won&apos;t affect your credit score &bull; Takes 30 seconds &bull; Safe &amp; secure
        </p>

        {/* Floating social proof counter */}
        <div className="reveal mt-12 flex items-center justify-center gap-6 stagger-6">
          {[
            { value: '5,000+', label: 'Happy customers' },
            { value: '₹50Cr+', label: 'Disbursed' },
            { value: '98%', label: 'Approval rate' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-[1.5rem] font-[900] text-brand-gold">{s.value}</span>
              <span className="text-[0.6rem] font-[700] uppercase tracking-[0.16em] text-white/35">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

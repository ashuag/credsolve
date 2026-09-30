'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { MAX_LOAN_DISPLAY } from '@/lib/brand';

export function HeroSection() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const [mobile, setMobile] = useState('');
  const [consent, setConsent] = useState(true);

  function onCheckEligibility(e: FormEvent) {
    e.preventDefault();
    const digits = mobile.replace(/\D/g, '').slice(-10);
    const href =
      digits.length === 10
        ? buildHrefWithSearch('/apply-for-loan', searchParams, { mobile: digits })
        : applyHref;
    router.push(href);
  }

  return (
    <section className="relative overflow-hidden bg-white pb-16 pt-8 sm:pb-20 sm:pt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Hero Grid: Left Content + Right Eligibility Card */}
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_480px] lg:gap-14 xl:grid-cols-[1.15fr_500px]">
          {/* Left Column */}
          <div className="flex flex-col items-start text-left">
            {/* Tag / Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#22C55E]/30 bg-[#E8F8EE] px-4 py-1.5 text-xs font-[700] uppercase tracking-wider text-[#16A34A]">
              <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
              CREDSOLVE TECHNOLOGIES
            </div>

            {/* Headline */}
            <h1 className="mt-5 text-[clamp(2.6rem,5.2vw,4.4rem)] font-[700] leading-[1.08] tracking-tight text-[#081735]">
              Credit Made <span className="text-[#22C55E]">Easy</span>.
            </h1>

            {/* Subheading */}
            <p className="mt-5 max-w-xl text-[1.08rem] font-[400] leading-relaxed text-[#081735]/85 sm:text-[1.15rem]">
              <strong className="font-[800] text-[#081735]">Instant Personal loan</strong> from our RBI-registered NBFC Partners. Apply with PAN &amp; get a decision in minutes.
            </p>

            {/* Benefit Pills */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {/* Up to ₹2,00,000 */}
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-[600] text-[#081735] shadow-xs">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#22C55E] text-xs font-bold text-[#16A34A]">
                  ₹
                </span>
                <span>Up to {MAX_LOAN_DISPLAY}</span>
              </div>

              {/* Approval in minutes */}
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-[600] text-[#081735] shadow-xs">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[#16A34A]">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                    <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                  </svg>
                </span>
                <span>Approval in minutes</span>
              </div>

              {/* 100% paperless */}
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-[600] text-[#081735] shadow-xs">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[#16A34A]">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="2" width="12" height="16" rx="2" />
                    <path d="M7 6h6M7 10h6M7 14h4" strokeLinecap="round" />
                  </svg>
                </span>
                <span>100% paperless</span>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="mt-8">
              <Link
                href={applyHref}
                className="inline-flex items-center justify-center rounded-full bg-[#22C55E] px-10 py-3.5 text-base font-[800] text-white shadow-[0_8px_20px_rgba(34,197,94,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#16A34A] hover:shadow-[0_12px_28px_rgba(34,197,94,0.45)] active:scale-[0.98]"
              >
                Get Loan
              </Link>
            </div>
          </div>

          {/* Right Column: Eligibility Form Card */}
          <div className="relative">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_15px_45px_rgba(11,30,61,0.07)]">
              {/* Navy Banner Header */}
              <div className="bg-[#0B1E3D] p-6 text-white sm:p-7">
                <h2 className="text-xl font-[800] tracking-tight sm:text-2xl">
                  Check what you are eligible for
                </h2>
                <p className="mt-2 text-xs font-[400] leading-relaxed text-white/80 sm:text-sm">
                  Enter your mobile number. It takes under a minute and does not affect your credit score.
                </p>
              </div>

              {/* Form Body */}
              <form onSubmit={onCheckEligibility} className="p-6 sm:p-7">
                <label
                  htmlFor="hero-mobile"
                  className="block text-[0.72rem] font-[800] uppercase tracking-wider text-[#0B1E3D]/70"
                >
                  MOBILE NUMBER
                </label>
                <div className="mt-2 flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-[#22C55E] focus-within:ring-2 focus-within:ring-[#22C55E]/20">
                  <span className="border-r border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-[700] text-[#0B1E3D]">
                    +91
                  </span>
                  <input
                    id="hero-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full px-3.5 py-3 text-base font-[600] text-[#0B1E3D] outline-none placeholder:text-slate-400"
                  />
                </div>

                {/* Consent Checkbox */}
                <label className="mt-5 flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    required
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#22C55E] focus:ring-[#22C55E]"
                  />
                  <span className="text-[0.7rem] font-[400] leading-relaxed text-[#0B1E3D]/65 sm:text-[0.72rem]">
                    This is my own mobile number and I agree to CredSolve&apos;s{' '}
                    <Link href="/terms-and-conditions" className="font-[700] text-[#0B1E3D] underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy-policy" className="font-[700] text-[#0B1E3D] underline">
                      Privacy Policy
                    </Link>
                    . I allow CredSolve to share my details with its RBI-registered lending partners to check my eligibility and process my application, and to reach me about it on call, SMS, RCS, WhatsApp and email.
                  </span>
                </label>

                {/* Check eligibility button */}
                <button
                  type="submit"
                  disabled={!consent}
                  className="mt-6 w-full rounded-xl bg-[#22C55E] py-3.5 text-center text-base font-[800] text-white shadow-[0_6px_20px_rgba(34,197,94,0.3)] transition-all hover:bg-[#16A34A] hover:shadow-[0_8px_25px_rgba(34,197,94,0.4)] disabled:opacity-50 active:scale-[0.98]"
                >
                  Check eligibility
                </button>

                <p className="mt-3 text-center text-[0.7rem] font-[400] text-slate-500">
                  A soft check only. Your final offer, including the full cost, comes from the lending partner.
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* Bottom Hero 3 Compact Feature Blocks — As shown in PDF */}
        <div className="mt-12 sm:mt-16 mx-auto max-w-3xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            {/* Card 1: Instant Decision */}
            <div className="group flex flex-col items-center justify-center rounded-2xl border border-slate-100/80 bg-white p-5 text-center shadow-[0_8px_24px_rgba(11,30,61,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(11,30,61,0.1)]">
              <Image
                src="/images/hero/card_instant_decision.png"
                alt="Instant Decision"
                width={200}
                height={200}
                className="w-full max-w-[150px] h-auto object-contain transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>

            {/* Card 2: 100% Online */}
            <div className="group flex flex-col items-center justify-center rounded-2xl border border-slate-100/80 bg-white p-5 text-center shadow-[0_8px_24px_rgba(11,30,61,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(11,30,61,0.1)]">
              <Image
                src="/images/hero/card_100_online.png"
                alt="100% Online"
                width={200}
                height={200}
                className="w-full max-w-[150px] h-auto object-contain transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>

            {/* Card 3: Secure Bank Transfer */}
            <div className="group flex flex-col items-center justify-center rounded-2xl border border-slate-100/80 bg-white p-5 text-center shadow-[0_8px_24px_rgba(11,30,61,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(11,30,61,0.1)]">
              <Image
                src="/images/hero/card_secure_transfer.png"
                alt="Secure Bank Transfer"
                width={200}
                height={200}
                className="w-full max-w-[150px] h-auto object-contain transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

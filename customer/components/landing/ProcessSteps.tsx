'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';

const JOURNEY_STEPS = [
  {
    step: 1,
    image: '/images/journey/step_1_identity.png',
    title: 'Verify your Identify',
    tag: '(Mobile & PAN Verification)',
    description: 'A quick and secure verification to get you started.',
  },
  {
    step: 2,
    image: '/images/journey/step_2_eligibility.png',
    title: 'Check Loan Eligibility',
    tag: '(Credit Score, Credit Record)',
    description: 'We check your credit profile to show you the best options.',
  },
  {
    step: 3,
    image: '/images/journey/step_3_offer.png',
    title: 'See Offer & Accept',
    tag: '(Loan Amount, Due Date, Terms & Condition)',
    description: 'Review your personalized offer and accept with confidence.',
  },
  {
    step: 4,
    image: '/images/journey/step_4_bank.png',
    title: 'Bank Account Verification',
    tag: '(Bank A/C & Name Verification)',
    description: 'We verify your bank account and name to ensure a safe transfer.',
  },
  {
    step: 5,
    image: '/images/journey/step_5_disbursal.png',
    title: 'Money in Bank',
    tag: '(Lender transfers the money)',
    description: 'Once verified, the lender transfers the money directly to your bank account.',
  },
  {
    step: 6,
    image: '/images/journey/step_6_repayment.png',
    title: 'Repayment',
    tag: '(Pay in Part Payments or Full)',
    description: 'Repay easily with flexible options — part payments or full repayment.',
  },
];

export function ProcessSteps() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);

  return (
    <section id="how-it-works" className="relative overflow-hidden bg-white py-16 sm:py-20 border-t border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Eyebrow */}
        <div className="text-center">
          <span className="text-xs font-[800] uppercase tracking-[0.2em] text-[#22C55E]">
            SIMPLE &bull; SECURE &bull; SMART
          </span>
        </div>

        <div className="relative mt-3 mb-12">
          <div
            className="pointer-events-none absolute left-1/2 top-6 h-36 w-72 -translate-x-1/2 rounded-full bg-[#22C55E]/10 blur-3xl"
            aria-hidden
          />

          <div className="relative mx-auto grid max-w-4xl grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-0">
            <div className="hidden sm:block" aria-hidden />

            <div className="text-center">
              <h2 className="text-[clamp(2.15rem,5vw,3.4rem)] font-[700] leading-none tracking-tight text-[#081735]">
                Your Lending <span className="text-[#22C55E]">Journey</span>
              </h2>
              <div className="mx-auto mt-3.5 h-1 w-14 rounded-full bg-[#22C55E]" />
            </div>

            <p className="justify-self-center text-center font-script leading-none text-[#12305A] sm:justify-self-start sm:pl-5 sm:text-left">
              <span className="block text-[1.7rem] font-semibold sm:text-[1.9rem]">Credit Made</span>
              <span className="mt-0.5 block text-[1.9rem] font-bold sm:text-[2.15rem]">Eazy</span>
              <svg viewBox="0 0 140 18" className="mx-auto mt-1 h-3 w-24 sm:mx-0" aria-hidden>
                <path
                  d="M6 12C32 5 72 4 104 8C118 10 130 13 134 11"
                  fill="none"
                  stroke="#22C55E"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                />
              </svg>
            </p>
          </div>

          <p className="relative mx-auto mt-5 max-w-2xl px-4 text-center text-sm font-[400] leading-relaxed text-[#081735]/75 sm:text-[0.98rem]">
            From application to funds in your account &mdash; a simple, transparent and secure process:
            <br className="hidden sm:inline" /> Get the support you need, every step of the way.
          </p>
        </div>

        {/* 6 Step Cards Grid with subtle chevrons between cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6 lg:gap-3">
          {JOURNEY_STEPS.map((item, index) => (
            <div key={item.step} className="relative flex flex-col items-center text-center">
              {/* Chevron arrow pointing to next step on large screens */}
              {index < JOURNEY_STEPS.length - 1 && (
                <div
                  className="hidden lg:flex absolute top-[110px] -right-2.5 z-10 text-[#22C55E] text-lg font-black select-none"
                  aria-hidden
                >
                  &gt;
                </div>
              )}

              {/* Number Badge */}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#081735] text-xs font-[800] text-white shadow-md">
                {item.step}
              </div>

              {/* Photo Card extracted from PDF */}
              <div className="mt-3.5 flex h-48 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-[#FAFBFD] shadow-xs transition-transform duration-300 hover:scale-[1.02] hover:shadow-md">
                <Image
                  src={item.image}
                  alt={item.title}
                  width={220}
                  height={240}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Text info */}
              <h3 className="mt-4 text-[0.95rem] font-[800] leading-tight text-[#081735]">
                {item.title}
              </h3>
              <p className="mt-1 text-[0.72rem] font-[600] text-slate-500">
                {item.tag}
              </p>
              <p className="mt-2 text-[0.76rem] font-[400] leading-snug text-[#081735]/70">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom Banner of Lending Journey (Page 2 Bottom) */}
        <div className="mt-14 overflow-hidden rounded-3xl border border-[#22C55E]/25 bg-gradient-to-r from-[#EAF8F0] via-[#F2FBF6] to-[#EAF8F0] p-6 shadow-xs sm:p-8">
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            {/* Left Tag & Headline */}
            <div className="text-center lg:text-left">
              <p className="text-xs font-[900] uppercase tracking-wider text-[#081735]">
                A BRIGHTER TOMORROW
              </p>
              <p className="text-xs font-[900] uppercase tracking-wider text-[#22C55E]">
                STARTS TODAY
              </p>
              <p className="mt-1 text-xs sm:text-sm font-[500] text-slate-600">
                Fast. Fair. Transparent. That&apos;s the CredSolve way.
              </p>
            </div>

            {/* Center Button */}
            <div className="flex flex-col items-center gap-1.5 text-center">
              <Link
                href={applyHref}
                className="inline-flex items-center gap-2 rounded-full bg-[#081735] px-8 py-3 text-sm font-[800] text-white shadow-md transition-all hover:bg-[#132d56] active:scale-[0.98]"
              >
                Get Started Today &rarr;
              </Link>
              <span className="text-[0.72rem] font-[400] text-slate-500">
                It takes just a few minutes.
              </span>
            </div>

            {/* Right 3 Trust Pillars */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-[700] text-[#081735]">
              {/* Secure & Trusted */}
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#16A34A]">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                    <path d="M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.887.87a1.54 1.54 0 0 0-1.044 1.262c-.596 4.477.787 7.795 2.464 9.99 1.579 2.068 3.438 3.03 4.145 3.303.14.054.26.082.35.082.09 0 .21-.028.35-.082.707-.273 2.566-1.235 4.145-3.303 1.677-2.195 3.06-5.513 2.464-9.99a1.54 1.54 0 0 0-1.044-1.263 62.467 62.467 0 0 0-2.887-.87C9.843.266 8.69 0 8 0zm2.146 5.854a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 8.793l2.646-2.647z" />
                  </svg>
                </span>
                <span>Secure &amp; Trusted</span>
              </div>

              {/* Quick Process */}
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#16A34A]">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                    <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                  </svg>
                </span>
                <span>Quick Process</span>
              </div>

              {/* Multiple Lending Partners */}
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#16A34A]">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                    <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                    <path fillRule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z" />
                    <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
                  </svg>
                </span>
                <span>Multiple Lending Partners</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

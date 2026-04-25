'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';

const STEPS = [
  {
    number: '01',
    title: 'Enter Your Details',
    description: 'Fill in your mobile number, name, and loan requirement. Takes just 30 seconds.',
    badge: '30 Seconds',
    badgeColor: '#1496f3',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
        <rect width="64" height="64" rx="20" fill="rgba(20,150,243,0.1)" />
        {/* Phone */}
        <rect x="20" y="12" width="24" height="40" rx="6" stroke="#1496f3" strokeWidth="2.5" />
        <rect x="22" y="18" width="20" height="24" rx="3" fill="rgba(20,150,243,0.1)" />
        {/* Lines on screen */}
        <path d="M26 22h12M26 26h8M26 30h10M26 34h6" stroke="#1496f3" strokeWidth="2" strokeLinecap="round" />
        {/* Home indicator */}
        <rect x="28" y="46" width="8" height="2" rx="1" fill="#1496f3" opacity="0.6" />
        {/* Cursor blink */}
        <rect x="26" y="22" width="2" height="4" rx="1" fill="#1496f3" className="animate-pulse" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Complete e-KYC',
    description: 'Verify identity with PAN & Aadhaar OTP. 100% paperless — no scanning, no uploads needed.',
    badge: '100% Paperless',
    badgeColor: '#f59e0b',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
        <rect width="64" height="64" rx="20" fill="rgba(245,158,11,0.1)" />
        {/* ID card */}
        <rect x="12" y="18" width="40" height="28" rx="6" stroke="#f59e0b" strokeWidth="2.5" />
        {/* Photo placeholder */}
        <rect x="18" y="24" width="12" height="12" rx="4" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth="1.5" />
        <circle cx="24" cy="27" r="2.5" fill="#f59e0b" opacity="0.6" />
        <path d="M18 36q3-2 6 0" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
        {/* Text lines */}
        <path d="M34 26h12M34 30h8M34 34h10" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        {/* Check badge */}
        <circle cx="46" cy="42" r="8" fill="#10b981" />
        <path d="M43 42l2 2.5 4-4" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Get Instant Approval',
    description: 'Our AI engine evaluates your application instantly. Money in your bank account in under 10 minutes.',
    badge: 'Money in 10 Min',
    badgeColor: '#10b981',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
        <rect width="64" height="64" rx="20" fill="rgba(16,185,129,0.1)" />
        {/* Bank building */}
        <rect x="16" y="28" width="32" height="20" rx="2" stroke="#10b981" strokeWidth="2.5" />
        {/* Pillars */}
        <rect x="20" y="30" width="4" height="16" rx="1" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1.5" />
        <rect x="30" y="30" width="4" height="16" rx="1" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1.5" />
        <rect x="40" y="30" width="4" height="16" rx="1" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1.5" />
        {/* Roof */}
        <path d="M12 28l20-12 20 12" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Top step */}
        <rect x="14" y="46" width="36" height="3" rx="1.5" fill="#10b981" />
        {/* Lightning bolt (instant) */}
        <path d="M30 10l-6 10h5l-1 8 7-10h-5l1-8z" fill="#ffc519" />
      </svg>
    ),
  },
];

export function ProcessSteps() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const sectionRef = useScrollReveal();

  return (
    <section id="how-it-works" ref={sectionRef} className="relative overflow-hidden bg-[#f8faff] py-20 lg:py-28">
      {/* Background */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1496f3]/5 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="reveal mb-5 inline-flex items-center gap-2.5 rounded-full bg-[#10b981]/10 px-4 py-2">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-[#10b981]" fill="currentColor">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <span className="text-[0.65rem] font-[900] uppercase tracking-[0.24em] text-[#10b981]">
              Get Money in 3 Simple Steps
            </span>
          </div>
          <h2 className="reveal text-[clamp(2rem,4.5vw,3.2rem)] font-[900] tracking-tight text-[#12244f] stagger-1">
            From Application to{' '}
            <span className="bg-[linear-gradient(135deg,#10b981,#059669)] bg-clip-text text-transparent">
              Bank Account.
            </span>
          </h2>
          <p className="reveal mx-auto mt-4 max-w-xl text-base font-[600] text-[#12244f]/50 stagger-2">
            100% digital process. No branch visits. No physical documents. Ever.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="absolute left-[16.6%] right-[16.6%] top-[4rem] hidden h-0.5 bg-gradient-to-r from-[#1496f3]/30 via-[#f59e0b]/30 to-[#10b981]/30 lg:block" />
          {/* Connector dots */}
          <div className="absolute left-[49.5%] top-[3.8rem] hidden h-2 w-2 -translate-x-1/2 rounded-full bg-[#f59e0b] lg:block" />

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            {STEPS.map((step, idx) => (
              <div
                key={idx}
                className={`reveal group relative flex flex-col items-center text-center stagger-${idx + 1}`}
              >
                {/* Number bubble */}
                <div className="relative mb-8">
                  {/* Pulse ring */}
                  <div
                    className="absolute inset-0 -m-3 rounded-[28px] opacity-30 animate-ring-pop"
                    style={{ backgroundColor: step.badgeColor }}
                  />
                  {/* Icon box */}
                  <div className="relative transition-all duration-400 group-hover:-translate-y-3 group-hover:shadow-[0_24px_60px_rgba(18,36,79,0.12)]">
                    {step.icon}
                  </div>
                  {/* Step number */}
                  <div
                    className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-[900] text-white shadow-lg"
                    style={{ backgroundColor: step.badgeColor }}
                  >
                    {step.number}
                  </div>
                </div>

                {/* Content */}
                <h3 className="mb-3 text-xl font-[900] tracking-tight text-[#12244f]">{step.title}</h3>
                <p className="mb-6 max-w-[280px] text-sm font-[600] leading-relaxed text-[#12244f]/50">
                  {step.description}
                </p>

                {/* Time badge */}
                <div
                  className="inline-flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-xs font-[800] uppercase tracking-[0.16em]"
                  style={{ borderColor: `${step.badgeColor}30`, color: step.badgeColor, backgroundColor: `${step.badgeColor}08` }}
                >
                  <span className="flex h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: step.badgeColor }} />
                  {step.badge}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="reveal mt-16 flex flex-col items-center gap-4 text-center stagger-4">
          <Link
            href={applyHref}
            className="group inline-flex items-center gap-3 rounded-2xl bg-[#12244f] px-12 py-5 text-lg font-[900] text-[#ffc519] shadow-[0_16px_40px_rgba(18,36,79,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(18,36,79,0.26)]"
          >
            Start Your Application
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="currentColor">
              <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
            </svg>
          </Link>
          <p className="text-xs font-[700] text-[#12244f]/35">
            No credit score required to check eligibility
          </p>
        </div>
      </div>
    </section>
  );
}

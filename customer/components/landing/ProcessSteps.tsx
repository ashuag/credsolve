'use client';

import Image from 'next/image';
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
    glowColor: 'rgba(20,150,243,0.18)',
    image: '/steps/step-details.png',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
        <rect width="64" height="64" rx="20" fill="rgba(20,150,243,0.1)" />
        <rect x="20" y="12" width="24" height="40" rx="6" stroke="#1496f3" strokeWidth="2.5" />
        <rect x="22" y="18" width="20" height="24" rx="3" fill="rgba(20,150,243,0.1)" />
        <path d="M26 22h12M26 26h8M26 30h10M26 34h6" stroke="#1496f3" strokeWidth="2" strokeLinecap="round" />
        <rect x="28" y="46" width="8" height="2" rx="1" fill="#1496f3" opacity="0.6" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Complete e-KYC',
    description: 'Verify identity with PAN & Aadhaar OTP. 100% paperless — no scanning, no uploads needed.',
    badge: '100% Paperless',
    badgeColor: '#f59e0b',
    glowColor: 'rgba(245,158,11,0.18)',
    image: '/steps/step-ekyc.png',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
        <rect width="64" height="64" rx="20" fill="rgba(245,158,11,0.1)" />
        <rect x="12" y="18" width="40" height="28" rx="6" stroke="#f59e0b" strokeWidth="2.5" />
        <rect x="18" y="24" width="12" height="12" rx="4" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth="1.5" />
        <circle cx="24" cy="27" r="2.5" fill="#f59e0b" opacity="0.6" />
        <path d="M34 26h12M34 30h8M34 34h10" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
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
    glowColor: 'rgba(16,185,129,0.18)',
    image: '/steps/step-approval.png',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
        <rect width="64" height="64" rx="20" fill="rgba(16,185,129,0.1)" />
        <rect x="16" y="28" width="32" height="20" rx="2" stroke="#10b981" strokeWidth="2.5" />
        <rect x="20" y="30" width="4" height="16" rx="1" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1.5" />
        <rect x="30" y="30" width="4" height="16" rx="1" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1.5" />
        <rect x="40" y="30" width="4" height="16" rx="1" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1.5" />
        <path d="M12 28l20-12 20 12" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="46" width="36" height="3" rx="1.5" fill="#10b981" />
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
      {/* Subtle centre glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1496f3]/4 blur-[120px]" />
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{ backgroundImage: 'radial-gradient(#12244f 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-20 text-center">
          <div className="reveal mb-5 inline-flex items-center gap-2.5 rounded-full bg-[#10b981]/10 px-5 py-2.5 shadow-[0_4px_20px_rgba(16,185,129,0.1)]">
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

        {/* Steps — open, box-free layout */}
        <div className="relative grid grid-cols-1 gap-16 lg:grid-cols-3 lg:gap-8">

          {/* Dashed connector (desktop only) */}
          <div className="pointer-events-none absolute top-[7.5rem] left-[calc(16.6%+3rem)] right-[calc(16.6%+3rem)] hidden lg:block">
            <svg width="100%" height="2" className="overflow-visible">
              <line
                x1="0" y1="1" x2="100%" y2="1"
                stroke="url(#stepGrad)"
                strokeWidth="2"
                strokeDasharray="6 5"
              />
              <defs>
                <linearGradient id="stepGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1496f3" stopOpacity="0.5" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.5" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {STEPS.map((step, idx) => (
            <div
              key={idx}
              className={`reveal group relative flex flex-col items-center text-center stagger-${idx + 1}`}
            >
              {/* Floating illustration circle */}
              <div className="relative mb-8">
                {/* Outer glow ring */}
                <div
                  className="absolute -inset-4 rounded-full opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: `radial-gradient(circle, ${step.glowColor}, transparent 70%)` }}
                />

                {/* Image / icon container — NO border box, just a soft circle background */}
                <div
                  className="relative flex h-36 w-36 items-center justify-center rounded-full transition-transform duration-500 ease-out group-hover:scale-105 group-hover:-translate-y-2"
                  style={{ background: `radial-gradient(circle at 50% 50%, ${step.glowColor}, rgba(248,250,255,0.4) 75%)` }}
                >
                  <div className="relative h-28 w-28">
                    <Image
                      src={step.image}
                      alt={step.title}
                      fill
                      className="object-contain drop-shadow-xl"
                      sizes="112px"
                      onError={(e) => {
                        // fallback to SVG icon if image not yet copied
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {/* SVG fallback shown underneath */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                      {step.icon}
                    </div>
                  </div>
                </div>

                {/* Step number — floating chip above circle */}
                <div
                  className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl text-[0.65rem] font-[900] text-white shadow-lg"
                  style={{ backgroundColor: step.badgeColor, boxShadow: `0 4px 12px ${step.glowColor}` }}
                >
                  {step.number}
                </div>
              </div>

              {/* Text */}
              <h3 className="mb-2 text-xl font-[900] tracking-tight text-[#12244f]">{step.title}</h3>
              <p className="mb-5 max-w-[260px] text-sm font-[600] leading-relaxed text-[#12244f]/50">
                {step.description}
              </p>

              {/* Badge pill */}
              <div
                className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-[800] uppercase tracking-[0.14em]"
                style={{
                  borderColor: `${step.badgeColor}30`,
                  color: step.badgeColor,
                  backgroundColor: `${step.badgeColor}08`,
                }}
              >
                <span className="flex h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: step.badgeColor }} />
                {step.badge}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="reveal mt-20 flex flex-col items-center gap-5 text-center stagger-4">
          <Link
            href={applyHref}
            className="group inline-flex items-center gap-3 rounded-2xl bg-[#12244f] px-12 py-5 text-lg font-[900] text-[#ffc519] shadow-[0_16px_40px_rgba(18,36,79,0.22)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(18,36,79,0.3)]"
          >
            Start Your Application
            <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="currentColor">
              <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
            </svg>
          </Link>
          <p className="text-xs font-[700] text-[#12244f]/35">
            No credit score required to check eligibility · Takes 30 seconds
          </p>
        </div>
      </div>
    </section>
  );
}

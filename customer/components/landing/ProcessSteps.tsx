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
    color: '#1496f3',
    glow: 'rgba(20,150,243,0.22)',
    hoverBorder: 'group-hover:border-[#1496f3]/30',
    hoverGlow: 'group-hover:shadow-[0_20px_50px_rgba(20,150,243,0.15)]',
    cardGlow: 'rgba(20,150,243,0.03)',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" className="h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20 transition-transform duration-500 group-hover:scale-110" aria-hidden>
        <circle cx="40" cy="40" r="30" fill="rgba(20,150,243,0.06)" className="transition-all duration-500 group-hover:fill-[rgba(20,150,243,0.12)]" />
        <rect x="24" y="10" width="32" height="56" rx="8" stroke="#1496f3" strokeWidth="3" className="transition-all duration-300 group-hover:stroke-[#2388e5]" />
        <rect x="28" y="16" width="24" height="34" rx="3" fill="rgba(20,150,243,0.08)" />
        <path d="M32 24h16M32 30h12M32 36h14" stroke="#1496f3" strokeWidth="2.5" strokeLinecap="round" className="origin-left transition-all duration-500 group-hover:scale-x-105" />
        <circle cx="40" cy="58" r="2.5" fill="#1496f3" opacity="0.7" />
        <circle cx="46" cy="30" r="2" fill="#2388e5" className="animate-pulse" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Complete e-KYC',
    description: 'Verify identity with PAN & Aadhaar OTP. 100% paperless — no scanning, no uploads needed.',
    badge: '100% Paperless',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.22)',
    hoverBorder: 'group-hover:border-[#f59e0b]/30',
    hoverGlow: 'group-hover:shadow-[0_20px_50px_rgba(245,158,11,0.15)]',
    cardGlow: 'rgba(245,158,11,0.03)',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" className="h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20 transition-transform duration-500 group-hover:scale-110" aria-hidden>
        <circle cx="36" cy="39" r="30" fill="rgba(245,158,11,0.06)" className="transition-all duration-500 group-hover:fill-[rgba(245,158,11,0.12)]" />
        <rect x="12" y="22" width="48" height="34" rx="8" stroke="#f59e0b" strokeWidth="3" className="transition-all duration-300 group-hover:stroke-[#e5a800]" />
        <rect x="18" y="28" width="14" height="14" rx="3" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth="1.5" />
        <circle cx="25" cy="33" r="2.5" fill="#f59e0b" />
        <path d="M20 41a5 5 0 0 1 10 0" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M38 29h16M38 35h10M38 41h14" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="58" cy="52" r="11" fill="#10b981" className="transition-transform duration-300 group-hover:scale-110" />
        <circle cx="58" cy="52" r="11" stroke="#10b981" strokeWidth="2" className="animate-ping" style={{ transformOrigin: '58px 52px' }} />
        <path d="M54 52l3 3 6-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Get Instant Approval',
    description: 'Our AI engine evaluates your application instantly. Money in your bank account in under 10 minutes.',
    badge: 'Money in 10 Min',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.22)',
    hoverBorder: 'group-hover:border-[#10b981]/30',
    hoverGlow: 'group-hover:shadow-[0_20px_50px_rgba(16,185,129,0.15)]',
    cardGlow: 'rgba(16,185,129,0.03)',
    icon: (
      <svg viewBox="0 0 80 80" fill="none" className="h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20 transition-transform duration-500 group-hover:scale-110" aria-hidden>
        <circle cx="40" cy="42" r="30" fill="rgba(16,185,129,0.06)" className="transition-all duration-500 group-hover:fill-[rgba(16,185,129,0.12)]" />
        <path d="M14 38l26-16 26 16v22H14V38z" stroke="#10b981" strokeWidth="3" strokeLinejoin="round" className="transition-all duration-300 group-hover:stroke-[#059669]" />
        <rect x="22" y="42" width="8" height="18" rx="2" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="2" />
        <rect x="36" y="42" width="8" height="18" rx="2" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="2" />
        <rect x="50" y="42" width="8" height="18" rx="2" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="2" />
        <rect x="12" y="58" width="56" height="5" rx="2.5" fill="#10b981" />
        <g className="animate-bounce" style={{ animationDuration: '3.5s' }}>
          <path d="M42 6l-6 11h5l-1 9 8-12h-5l1-8z" fill="#f59e0b" className="transition-all duration-300 group-hover:fill-[#ffc519]" />
          <path d="M42 6l-6 11h5l-1 9 8-12h-5l1-8z" stroke="#ffc519" strokeWidth="1.2" opacity="0.6" className="animate-ping" style={{ transformOrigin: '42px 16px' }} />
        </g>
      </svg>
    ),
  },
];

export function ProcessSteps() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const sectionRef = useScrollReveal();

  return (
    <section id="how-it-works" ref={sectionRef} className="relative overflow-hidden bg-[#f4f8fc] py-20 lg:py-28">
      {/* Self-contained CSS Animations for Vector Flow Lines */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes lineDash {
          to {
            stroke-dashoffset: -40;
          }
        }
        .animate-line-dash {
          stroke-dasharray: 8, 12;
          animation: lineDash 2s linear infinite;
        }
      `}} />

      {/* Soft horizon glows and ambient colored blobs */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(20,150,243,0.06),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: 'radial-gradient(#12244f 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        aria-hidden
      />

      {/* Decorative Blur Blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[380px] w-[380px] rounded-full bg-[#1496f3]/5 blur-[100px] animate-blob" />
      <div className="pointer-events-none absolute top-1/2 left-1/3 h-[300px] w-[300px] rounded-full bg-[#f59e0b]/4 blur-[100px] animate-blob animation-delay-2000" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[380px] w-[380px] rounded-full bg-[#10b981]/5 blur-[100px] animate-blob animation-delay-4000" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center lg:mb-24">
          <div className="reveal mx-auto mb-5 inline-flex items-center gap-2.5 rounded-full bg-[#1496f3]/10 px-5 py-2.5 shadow-[0_4px_20px_rgba(20,150,243,0.06)]">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#1496f3]" />
            <span className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#1496f3]">
              Simple 3-Step Process
            </span>
          </div>
          <h2 className="reveal text-[clamp(2.15rem,4.5vw,3.4rem)] font-[900] leading-tight tracking-tight text-brand-navy">
            From Application to{' '}
            <span className="bg-gradient-to-r from-[#10b981] via-[#059669] to-[#1496f3] bg-clip-text text-transparent">
              Bank Account.
            </span>
          </h2>
          <p className="reveal mx-auto mt-5 max-w-xl text-base font-[600] text-brand-muted stagger-1">
            100% digital process. No branch visits. No physical documents. Ever.
          </p>
        </div>

        {/* Steps container grid */}
        <div className="relative">
          {/* Connecting dashed vector path (Desktop only) */}
          <div className="absolute top-[28%] left-[12%] right-[12%] hidden lg:block z-0 pointer-events-none">
            <svg className="w-full h-24 overflow-visible" fill="none" viewBox="0 0 800 100" preserveAspectRatio="none">
              <path
                d="M 10 50 Q 200 -15 400 50 T 790 50"
                stroke="url(#step-line-gradient)"
                strokeWidth="3.5"
                fill="none"
                className="animate-line-dash"
                opacity="0.65"
              />
              <defs>
                <linearGradient id="step-line-gradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1496f3" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Grid of Steps */}
          <div className="relative z-10 grid grid-cols-1 gap-14 sm:gap-16 lg:grid-cols-3 lg:gap-10">
            {STEPS.map((step, idx) => (
              <div
                key={step.number}
                className={`reveal group relative flex flex-col items-center text-center stagger-${idx + 1}`}
              >
                {/* Process Card */}
                <div
                  className={`relative w-full flex flex-col items-center bg-white/75 backdrop-blur-md border border-white/80 rounded-[2rem] p-8 pb-9 shadow-[0_12px_36px_rgba(18,36,79,0.03)] transition-all duration-500 hover:-translate-y-2.5 ${step.hoverBorder} ${step.hoverGlow}`}
                  style={{
                    background: `radial-gradient(circle at top right, ${step.cardGlow}, transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))`
                  }}
                >
                  {/* Glassmorphic step number badge overlapping top border */}
                  <div
                    className="absolute -top-5 left-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full text-xs font-[900] text-white shadow-lg border border-white/40"
                    style={{
                      backgroundColor: step.color,
                      boxShadow: `0 6px 20px ${step.glow}`,
                    }}
                  >
                    {step.number}
                  </div>

                  {/* Icon Cluster container with hover glow */}
                  <div className="relative mt-4 mb-6">
                    {/* Radial Glow */}
                    <div
                      className="absolute -inset-8 rounded-full opacity-0 blur-2xl transition-all duration-500 group-hover:opacity-100"
                      style={{ background: `radial-gradient(circle, ${step.glow}, transparent 70%)` }}
                      aria-hidden
                    />
                    {/* Circle Backdrop */}
                    <div
                      className="relative flex h-32 w-32 items-center justify-center rounded-full border border-white/60 bg-white/40 shadow-inner transition-transform duration-500 group-hover:scale-105"
                      style={{ background: `radial-gradient(circle at 50% 45%, ${step.glow}, rgba(255,255,255,0.2) 75%)` }}
                    >
                      {step.icon}
                    </div>
                  </div>

                  {/* Text Contents */}
                  <h3 className="mb-3.5 text-xl font-[900] tracking-tight text-brand-navy transition-colors duration-300">
                    {step.title}
                  </h3>
                  <p className="mb-6 max-w-[260px] text-[0.88rem] font-[600] leading-relaxed text-brand-muted">
                    {step.description}
                  </p>

                  {/* Pill Badge */}
                  <span
                    className="mt-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[0.68rem] font-[800] uppercase tracking-[0.14em] shadow-sm transition-all duration-300 group-hover:scale-105"
                    style={{
                      borderColor: `${step.color}25`,
                      color: step.color,
                      backgroundColor: `${step.color}08`,
                      boxShadow: `0 4px 12px ${step.color}05`,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: step.color }}
                      aria-hidden
                    />
                    {step.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="reveal mt-16 flex justify-center lg:mt-24 stagger-4">
          <Link
            href={applyHref}
            className="group relative overflow-hidden inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-navy to-[#12244f] px-10 py-4 text-base font-[900] text-brand-gold shadow-[0_16px_40px_rgba(18,36,79,0.22)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_24px_56px_rgba(18,36,79,0.32)] active:scale-95 sm:px-12 sm:py-5 sm:text-lg"
          >
            {/* Sheen animation sweep overlay */}
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[sheenPass_1.8s_ease-in-out_infinite]" />

            <span className="relative z-10">Start Your Application</span>
            <svg viewBox="0 0 20 20" className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5" fill="currentColor" aria-hidden>
              <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

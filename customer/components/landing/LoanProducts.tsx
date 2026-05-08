'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';

const LOAN_TYPES = [
  {
    id: 'payday',
    title: 'Payday Advance',
    subtitle: 'Bridge your salary gap',
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-14 w-14">
        <rect x="8" y="16" width="48" height="34" rx="8" stroke="#f59e0b" strokeWidth="3.5" />
        <path d="M8 27h48" stroke="#f59e0b" strokeWidth="3.5" />
        <circle cx="20" cy="39" r="3.5" fill="#f59e0b" />
        <circle cx="32" cy="39" r="3.5" fill="#f59e0b" />
        <circle cx="44" cy="39" r="3.5" fill="#f59e0b" opacity="0.3" />
      </svg>
    ),
  },
  {
    id: 'emergency',
    title: 'Emergency Fund',
    subtitle: 'Flexible EMI repayment',
    color: '#10b981',
    bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-14 w-14">
        <circle cx="32" cy="22" r="11" stroke="#10b981" strokeWidth="3.5" />
        <path d="M13 52c0-10.493 8.507-19 19-19s19 8.507 19 19" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'medical',
    title: 'Medical Emergency',
    subtitle: 'Zero processing fee',
    color: '#f43f5e',
    bg: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-14 w-14">
        <rect x="27" y="10" width="10" height="44" rx="5" fill="#f43f5e" />
        <rect x="10" y="27" width="44" height="10" rx="5" fill="#f43f5e" />
      </svg>
    ),
  },
  {
    id: 'education',
    title: 'Education Fee',
    subtitle: 'Study now, pay later',
    color: '#8b5cf6',
    bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-14 w-14">
        <path d="M10 30l22-13 22 13-22 13-22-13z" stroke="#8b5cf6" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M54 30v14" stroke="#8b5cf6" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M20 36v8a12 12 0 0024 0v-8" stroke="#8b5cf6" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function LoanProducts() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const sectionRef = useScrollReveal();

  return (
    <section id="loans" ref={sectionRef} className="relative overflow-hidden bg-[#f8faff] py-20 lg:py-28">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(#12244f 1.5px, transparent 1.5px)', backgroundSize: '36px 36px' }}
      />
      <div className="pointer-events-none absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#1496f3]/6 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#ffc519]/6 blur-[80px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="reveal mx-auto mb-5 inline-flex items-center gap-2.5 rounded-full bg-[#1496f3]/10 px-4 py-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#1496f3]" />
            <span className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#1496f3]">
              Short-Term Loans up to ₹50,000
            </span>
          </div>
          <h2 className="reveal text-[clamp(2rem,4.5vw,3.2rem)] font-black leading-tight tracking-tight text-[#12244f] stagger-1">
            Pick the Loan that Fits{' '}
            <span className="bg-[linear-gradient(135deg,#1496f3,#1c347d)] bg-clip-text text-transparent">
              Your Life.
            </span>
          </h2>
          <p className="reveal mx-auto mt-4 max-w-2xl text-base font-semibold leading-relaxed text-[#12244f]/50 stagger-2">
            From same-day micro loans to structured EMI plans — transparent rates, zero hidden charges.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {LOAN_TYPES.map((loan, idx) => (
            <div
              key={loan.id}
              className={`reveal group flex flex-col overflow-hidden rounded-3xl border border-[rgba(18,36,79,0.07)] bg-white shadow-[0_4px_20px_rgba(18,36,79,0.07)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(18,36,79,0.14)] stagger-${Math.min(idx + 1, 6)}`}
            >
              {/* Colored icon zone */}
              <div
                className="flex flex-col items-center justify-center gap-4 px-6 py-10"
                style={{ background: loan.bg }}
              >
                <div className="transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1 drop-shadow-sm">
                  {loan.icon}
                </div>
              </div>

              {/* Title + CTA */}
              <div className="flex flex-col gap-4 px-5 py-5">
                <div className="text-center">
                  <div className="text-[1rem] font-black tracking-tight text-[#12244f]">{loan.title}</div>
                  <div className="mt-0.5 text-[0.7rem] font-semibold text-[#12244f]/45">{loan.subtitle}</div>
                </div>

                <Link
                  href={applyHref}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black text-white transition-all duration-200 hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: loan.color }}
                >
                  Apply Now
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="currentColor">
                    <path d="M8.293 2.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 9H2a1 1 0 010-2h9.586L8.293 3.707a1 1 0 010-1.414z" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="reveal mt-10 text-center text-[0.65rem] font-semibold text-[#12244f]/30 stagger-6">
          *T&amp;C Apply | Interest rates may vary based on credit profile | All loans subject to RBI guidelines and credit appraisal
        </p>
      </div>
    </section>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';

const LOAN_TYPES = [
  {
    id: 'payday',
    title: 'Payday Advance',
    subtitle: 'Bridge your salary gap',
    maxAmount: '30,000',
    tenure: 'Up to 45 days',
    color: '#f59e0b',
    bg: 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)',
    border: 'rgba(245,158,11,0.2)',
    image: '/loans/loan-payday.png',
  },
  {
    id: 'emergency',
    title: 'Emergency Fund',
    subtitle: 'Flexible EMI repayment',
    maxAmount: '30,000',
    tenure: 'Up to 45 days',
    color: '#10b981',
    bg: 'linear-gradient(145deg, #ecfdf5 0%, #d1fae5 100%)',
    border: 'rgba(16,185,129,0.2)',
    image: '/loans/loan-emergency.png',
  },
  {
    id: 'medical',
    title: 'Medical Emergency',
    subtitle: 'Zero processing fee',
    maxAmount: '30,000',
    tenure: 'Up to 45 days',
    color: '#f43f5e',
    bg: 'linear-gradient(145deg, #fff1f2 0%, #ffe4e6 100%)',
    border: 'rgba(244,63,94,0.2)',
    image: '/loans/loan-medical.png',
  },
  {
    id: 'education',
    title: 'Education Fee',
    subtitle: 'Study now, pay later',
    maxAmount: '30,000',
    tenure: 'Up to 45 days',
    color: '#8b5cf6',
    bg: 'linear-gradient(145deg, #f5f3ff 0%, #ede9fe 100%)',
    border: 'rgba(139,92,246,0.2)',
    image: '/loans/loan-education.png',
  },
];

export function LoanProducts() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const sectionRef = useScrollReveal();

  return (
    <section id="loans" ref={sectionRef} className="relative overflow-hidden bg-[#f8faff] py-20 lg:py-28">
      {/* Background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.022]"
        style={{ backgroundImage: 'radial-gradient(#12244f 1.5px, transparent 1.5px)', backgroundSize: '36px 36px' }}
      />
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#1496f3]/8 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#ffc519]/8 blur-[80px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-14 text-center">
          <div className="reveal mx-auto mb-5 inline-flex items-center gap-2.5 rounded-full bg-[#1496f3]/10 px-5 py-2.5 shadow-[0_4px_20px_rgba(20,150,243,0.1)]">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#1496f3]" />
            <span className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#1496f3]">
              Short-Term Loans up to 30,000
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
              className={`reveal group flex flex-col overflow-hidden rounded-3xl border shadow-[0_4px_24px_rgba(18,36,79,0.06)] transition-all duration-300 hover:-translate-y-2.5 hover:shadow-[0_20px_48px_rgba(18,36,79,0.14)] stagger-${Math.min(idx + 1, 6)}`}
              style={{ background: loan.bg, borderColor: loan.border }}
            >
              {/* Illustration zone */}
              <div className="relative h-44 w-full overflow-hidden">
                {/* Radial glow behind image */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-30 blur-2xl"
                  style={{ background: `radial-gradient(circle at 50% 60%, ${loan.color}, transparent 70%)` }}
                />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="relative h-36 w-36 transition-transform duration-500 ease-out group-hover:scale-110 group-hover:-translate-y-1 drop-shadow-xl">
                    <Image
                      src={loan.image}
                      alt={loan.title}
                      fill
                      className="object-contain"
                      sizes="144px"
                    />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col gap-4 bg-white/70 px-5 py-5 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-[1rem] font-black tracking-tight text-[#12244f]">{loan.title}</div>
                  <div className="mt-0.5 text-[0.7rem] font-semibold text-[#12244f]/45">{loan.subtitle}</div>
                </div>

                {/* Mini stats */}
                <div className="flex justify-center gap-3 text-center">
                  <div className="flex flex-col">
                    <span className="text-[0.58rem] font-[800] uppercase tracking-[0.14em] text-[#12244f]/35">Max</span>
                    <span className="text-[0.8rem] font-[900]" style={{ color: loan.color }}>₹{loan.maxAmount}</span>
                  </div>
                  <div className="w-px bg-[#12244f]/8" />
                  <div className="flex flex-col">
                    <span className="text-[0.58rem] font-[800] uppercase tracking-[0.14em] text-[#12244f]/35">Term</span>
                    <span className="text-[0.8rem] font-[900] text-[#12244f]">{loan.tenure}</span>
                  </div>
                </div>

                <Link
                  href={applyHref}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.02] active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
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

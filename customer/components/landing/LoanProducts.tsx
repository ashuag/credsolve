'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';

const SHORT_TERM_LOANS = [
  {
    id: 'payday',
    title: 'Payday Advance',
    subtitle: 'Bridge Your Salary Gap',
    amount: '₹5,000 – ₹25,000',
    duration: 'Up to 30 Days',
    rate: '0.08% per day flat',
    fee: '1.5% processing fee',
    color: '#f59e0b',
    lightColor: 'rgba(245,158,11,0.08)',
    badge: 'Most Popular',
    features: ['Salary account required', 'Auto-debit repayment', 'Renew up to 3 times'],
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-12 w-12">
        <circle cx="24" cy="24" r="24" fill="rgba(245,158,11,0.12)" />
        <rect x="10" y="14" width="28" height="22" rx="4" stroke="#f59e0b" strokeWidth="2.5" />
        <path d="M10 20h28" stroke="#f59e0b" strokeWidth="2.5" />
        <circle cx="16" cy="28" r="2" fill="#f59e0b" />
        <circle cx="24" cy="28" r="2" fill="#f59e0b" />
        <circle cx="32" cy="28" r="2" fill="#f59e0b" opacity="0.4" />
      </svg>
    ),
  },
  {
    id: 'Emergency Fund',
    title: 'Emergency Fund',
    subtitle: 'Flexible EMI Repayment',
    amount: '₹10,000 – ₹50,000',
    duration: '3 – 6 Months',
    rate: 'Starting @ 18% p.a.',
    fee: '1% processing fee',
    color: '#10b981',
    lightColor: 'rgba(16,185,129,0.08)',
    badge: 'Best Value',
    features: ['PAN + Aadhaar required', 'Pay in easy monthly EMIs', 'Part-prepayment allowed'],
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-12 w-12">
        <circle cx="24" cy="24" r="24" fill="rgba(16,185,129,0.12)" />
        <circle cx="24" cy="18" r="6" stroke="#10b981" strokeWidth="2.5" />
        <path d="M12 36c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'medical',
    title: 'Medical Emergency',
    subtitle: 'Zero Processing Fee',
    amount: '₹5,000 – ₹50,000',
    duration: '1 – 12 Months',
    rate: 'Starting @ 15% p.a.',
    fee: '0% processing fee',
    color: '#f43f5e',
    lightColor: 'rgba(244,63,94,0.08)',
    badge: 'Special Rate',
    features: ['Hospital bill as proof', 'Pre & post hospitalization', 'Instant sanction letter'],
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-12 w-12">
        <circle cx="24" cy="24" r="24" fill="rgba(244,63,94,0.12)" />
        <rect x="20" y="12" width="8" height="24" rx="4" fill="#f43f5e" />
        <rect x="12" y="20" width="24" height="8" rx="4" fill="#f43f5e" />
      </svg>
    ),
  },
  {
    id: 'education',
    title: 'Education Fee',
    subtitle: 'Study Now, Pay Later',
    amount: '₹5,000 – ₹50,000',
    duration: '3 – 12 Months',
    rate: 'Starting @ 12% p.a.',
    fee: '0.5% processing fee',
    color: '#8b5cf6',
    lightColor: 'rgba(139,92,246,0.08)',
    badge: 'Lowest Rate',
    features: ['Fee receipt as proof', 'School / college / coaching', 'Moratorium available'],
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-12 w-12">
        <circle cx="24" cy="24" r="24" fill="rgba(139,92,246,0.12)" />
        <path d="M10 22l14-8 14 8-14 8-14-8z" stroke="#8b5cf6" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M38 22v10" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M16 26v6a8 8 0 0016 0v-6" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
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
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(#12244f 1.5px, transparent 1.5px)', backgroundSize: '36px 36px' }}
      />
      {/* Corner blobs */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#1496f3]/6 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#ffc519]/6 blur-[80px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="reveal mx-auto mb-5 inline-flex items-center gap-2.5 rounded-full bg-[#1496f3]/10 px-4 py-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#1496f3]" />
            <span className="text-[0.65rem] font-[900] uppercase tracking-[0.24em] text-[#1496f3]">
              Short-Term Loans up to ₹50,000
            </span>
          </div>
          <h2 className="reveal text-[clamp(2rem,4.5vw,3.2rem)] font-[900] leading-tight tracking-tight text-[#12244f] stagger-1">
            Pick the Loan that Fits{' '}
            <span className="bg-[linear-gradient(135deg,#1496f3,#1c347d)] bg-clip-text text-transparent">
              Your Life.
            </span>
          </h2>
          <p className="reveal mx-auto mt-4 max-w-2xl text-base font-[600] leading-relaxed text-[#12244f]/50 stagger-2">
            From same-day micro loans to structured EMI plans — transparent rates, zero hidden charges.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SHORT_TERM_LOANS.map((loan, idx) => (
            <div
              key={loan.id}
              className={`reveal group relative flex flex-col rounded-[28px] border border-[rgba(18,36,79,0.07)] bg-white pt-6 shadow-[0_8px_32px_rgba(18,36,79,0.06)] transition-all duration-400 hover:-translate-y-2 hover:shadow-[0_24px_60px_rgba(18,36,79,0.12)] stagger-${Math.min(idx + 1, 6)} overflow-hidden`}
              style={{ '--accent-color': loan.color } as React.CSSProperties}
            >
              {/* Color accent top bar */}
              <div className="loan-card-accent" />

              {/* Popular / rate badge */}
              {loan.badge && (
                <div
                  className="absolute right-4 top-5 rounded-full px-3 py-1 text-[0.6rem] font-[900] uppercase tracking-[0.15em] text-white shadow-sm"
                  style={{ backgroundColor: loan.color }}
                >
                  {loan.badge}
                </div>
              )}

              <div className="flex flex-col gap-4 px-6 pb-6">
                {/* Icon */}
                <div className="transition-transform duration-400 group-hover:scale-105">
                  {loan.icon}
                </div>

                {/* Name + subtitle */}
                <div>
                  <h3 className="text-lg font-[900] tracking-tight text-[#12244f]">{loan.title}</h3>
                  <p className="mt-0.5 text-[0.7rem] font-[700] uppercase tracking-[0.18em] text-[#12244f]/35">{loan.subtitle}</p>
                </div>

                {/* Amount + Duration */}
                <div className="flex flex-col gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: loan.lightColor }}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[0.62rem] font-[800] uppercase tracking-[0.16em] text-[#12244f]/40">Amount</span>
                    <span className="text-sm font-[900] text-[#12244f]">{loan.amount}</span>
                  </div>
                  <div className="h-px bg-[rgba(18,36,79,0.06)]" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-[0.62rem] font-[800] uppercase tracking-[0.16em] text-[#12244f]/40">Duration</span>
                    <span className="text-sm font-[900] text-[#12244f]">{loan.duration}</span>
                  </div>
                </div>

                {/* Rate */}
                <div className="flex items-center justify-between">
                  <span className="text-[0.62rem] font-[800] uppercase tracking-[0.16em] text-[#12244f]/40">Interest</span>
                  <span className="text-sm font-[900]" style={{ color: loan.color }}>{loan.rate}</span>
                </div>

                {/* Features */}
                <ul className="flex flex-col gap-2">
                  {loan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[0.78rem] font-[600] text-[#12244f]/60">
                      <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="currentColor" style={{ color: loan.color }}>
                        <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Fee note */}
                <div className="text-[0.62rem] font-[700] text-[#12244f]/30">
                  {loan.fee}
                </div>
              </div>

              {/* CTA */}
              <div className="mt-auto border-t border-[rgba(18,36,79,0.06)] px-6 py-4">
                <Link
                  href={applyHref}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-[900] text-white transition-all duration-200 group-hover:opacity-90"
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

        {/* Bottom disclaimer */}
        <p className="reveal mt-10 text-center text-[0.65rem] font-[600] text-[#12244f]/30 stagger-6">
          *T&amp;C Apply | Interest rates may vary based on credit profile | All loans subject to RBI guidelines and credit appraisal
        </p>
      </div>
    </section>
  );
}

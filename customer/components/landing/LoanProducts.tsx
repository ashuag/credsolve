'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { resolveLandingLoanPurpose } from '@/lib/loan-purpose-selection';

type LoanNeed = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

const LOAN_NEEDS: LoanNeed[] = [
  {
    id: 'emergency',
    title: 'Emergency Funds',
    description: "Be prepared for life's unexpected moments.",
    icon: '/images/loans/icon_emergency.png',
  },
  {
    id: 'payday',
    title: 'Short Term Loan',
    description: 'Get quick funds for your short-term needs.',
    icon: '/images/loans/icon_short_term.png',
  },
  {
    id: 'medical',
    title: 'Medical Emergency',
    description: 'Financial support when health matters most.',
    icon: '/images/loans/icon_medical.png',
  },
  {
    id: 'business',
    title: 'Small Business Loan',
    description: 'Fuel your business growth with easy financing.',
    icon: '/images/loans/icon_business.png',
  },
  {
    id: 'purchase',
    title: 'Important Purchase',
    description: 'Make your big purchases happen, easily.',
    icon: '/images/loans/icon_purchase.png',
  },
  {
    id: 'education',
    title: 'Education Fee',
    description: 'Invest in a brighter future.',
    icon: '/images/loans/icon_education.png',
  },
  {
    id: 'travel',
    title: 'Travel Expense',
    description: 'Explore the world without financial worries.',
    icon: '/images/loans/icon_travel.png',
  },
  {
    id: 'all',
    title: 'Loan for All',
    description: 'Flexible solutions for every stage of life.',
    icon: '/images/loans/icon_loan_for_all.png',
  },
];

function WaveBanner() {
  return (
    <div
      className="relative mt-20 h-[150px] w-full overflow-hidden bg-white sm:h-[188px] lg:h-[220px]"
      role="img"
      aria-label="CredSolve. Credit made easy. Same dreams. A smoother tomorrow."
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 280"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          fill="#07172E"
          d="M0 92C90 58 170 78 250 108C360 150 470 168 590 150C730 128 800 48 960 36C1100 26 1220 78 1440 108V280H0Z"
        />
        <path
          fill="#0C2346"
          d="M0 196C240 228 420 176 680 188C960 202 1160 246 1440 210V280H0Z"
        />
        <path fill="#1FA34A" d="M0 0C140 10 230 48 280 100C190 72 90 48 0 78Z" />
        <path fill="#22C55E" d="M0 0C110 4 190 32 230 72C150 48 70 28 0 48Z" />
        <path
          fill="#22C55E"
          d="M180 132C520 176 760 92 1000 80C1180 70 1320 108 1440 130L1440 156C1300 128 1160 94 980 108C740 124 520 186 180 132Z"
        />
        <path
          fill="#148A3C"
          d="M0 162C250 192 470 150 730 158C1010 168 1220 198 1440 170L1440 184C1200 212 990 180 710 172C450 164 230 204 0 176Z"
        />
      </svg>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-5 pb-3 sm:px-12 sm:pb-5 lg:px-16 lg:pb-6">
        <div className="min-w-0 leading-none">
          <p className="text-[1.45rem] font-[900] tracking-tight text-white sm:text-[2rem] lg:text-[2.35rem]">
            Cred<span className="text-[#22C55E]">Solve</span>
          </p>
          <p className="mt-1.5 text-[0.5rem] font-[700] uppercase tracking-[0.22em] text-white/75 sm:text-[0.68rem]">
            Credit Made Eazy
          </p>
        </div>
        <p className="max-w-[46%] shrink-0 pb-1 text-right text-[0.68rem] font-[600] leading-snug text-white sm:max-w-none sm:text-[0.95rem] lg:text-[1.05rem]">
          Same Dreams.{' '}
          <span className="font-[700] text-[#22C55E]">A Smoother Tomorrow.</span>
        </p>
      </div>
    </div>
  );
}

export function LoanProducts() {
  const searchParams = useSearchParams();

  return (
    <section id="loans" className="relative overflow-hidden bg-white pt-16 sm:pt-20 border-t border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative mb-14">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22C55E]/10 blur-3xl"
            aria-hidden
          />

          <div className="relative mx-auto grid max-w-4xl grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-0">
            <div className="hidden sm:block" aria-hidden />

            <div className="text-center">
              <h2 className="text-[clamp(2.35rem,6vw,3.75rem)] font-[700] leading-none tracking-tight text-[#081735]">
                Loan for <span className="text-[#22C55E]">All</span>
              </h2>
              <div className="mx-auto mt-3.5 h-1 w-14 rounded-full bg-[#22C55E]" />
            </div>

            <p className="justify-self-center text-center font-script leading-none text-[#12305A] sm:justify-self-start sm:pl-5 sm:text-left">
              <span className="block text-[1.65rem] font-semibold sm:text-[1.85rem]">Your Goals</span>
              <span className="mt-0.5 block text-[1.85rem] font-bold sm:text-[2.15rem]">Our Support</span>
              <svg viewBox="0 0 180 18" className="mx-auto mt-1 h-3 w-36 sm:mx-0 sm:w-40" aria-hidden>
                <path
                  d="M6 12C40 5 90 4 130 8C150 10 168 13 174 11"
                  fill="none"
                  stroke="#22C55E"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                />
              </svg>
            </p>
          </div>

          <p className="relative mx-auto mt-5 max-w-xl px-4 text-center text-base font-[500] text-[#081735]/70 sm:text-[1.05rem]">
            Quick Funds for Every Need in Life
          </p>
        </div>

        {/* 8 Loan Cards Grid (4 columns x 2 rows) */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {LOAN_NEEDS.map((loan) => {
            const loanPurpose = resolveLandingLoanPurpose(loan.id);
            const href = buildHrefWithSearch(
              '/apply-for-loan',
              searchParams,
              loanPurpose ? { loanPurpose } : undefined,
            );

            return (
              <Link
                key={loan.id}
                href={href}
                className="group flex flex-col items-center justify-center rounded-3xl border border-slate-100 bg-[#FAFBFD] p-7 text-center shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:border-[#22C55E]/30 hover:bg-white hover:shadow-lg"
              >
                {/* Circular Icon extracted from PDF */}
                <div className="flex h-20 w-20 items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <Image
                    src={loan.icon}
                    alt={loan.title}
                    width={80}
                    height={80}
                    className="h-full w-full object-contain"
                  />
                </div>

                {/* Title */}
                <h3 className="mt-4 text-base font-[800] text-[#081735] transition-colors group-hover:text-[#22C55E]">
                  {loan.title}
                </h3>

                {/* Small green accent line beneath title */}
                <div className="mt-1.5 h-0.5 w-6 rounded-full bg-[#22C55E]/60 transition-all group-hover:w-10 group-hover:bg-[#22C55E]" />

                {/* Description */}
                <p className="mt-2.5 text-xs font-[400] leading-relaxed text-[#081735]/65">
                  {loan.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      <WaveBanner />
    </section>
  );
}

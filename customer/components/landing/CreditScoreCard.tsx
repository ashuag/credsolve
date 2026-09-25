'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';

export function CreditScoreCard() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Why Choose Section */}
          <div className="mc-card border-[rgba(18,36,79,0.06)] bg-[#f8fbff]/50 p-10">
            <h2 className="mb-8 text-3xl font-black tracking-tight text-[#12244f]">
              Why Choose <span className="text-[#1496f3]">CredSolve?</span>
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[
                { title: 'Instant Approval', desc: 'Get approved in 2 minutes', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                { title: '100% Paperless', desc: 'No paperwork • Fully digital', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                { title: 'Flexible Repayment', desc: 'Tenure up to 60 months', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1496f3]/10 text-[#1496f3]">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-base font-black text-[#12244f]">{item.title}</h4>
                    <p className="text-sm font-medium text-[#12244f]/60">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Credit Score Section */}
          <div className="mc-card border-[rgba(18,36,79,0.06)] bg-white p-10 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-3xl font-black tracking-tight text-[#12244f]">Check Your <span className="text-[#22c55e]">Credit Score</span></h2>
              <p className="mt-2 text-sm font-medium text-[#12244f]/60">Know your credit health • Absolutely Free</p>
            </div>
            
            <div className="flex flex-col items-center gap-8 md:flex-row">
              <div className="relative flex h-48 w-48 items-center justify-center">
                {/* Simplified Gauge */}
                <svg viewBox="0 0 100 100" className="h-full w-full rotate-[-90deg]">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" strokeDasharray="125 250" strokeLinecap="round" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="url(#gaugeGrad)" strokeWidth="10" strokeDasharray="100 250" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="50%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                  <span className="text-4xl font-black text-[#12244f]">782</span>
                  <span className="text-xs font-black uppercase tracking-widest text-green-600">Very Good</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {[
                  'Instant credit score check',
                  'No impact on your score',
                  'Free detailed report',
                  '100% Secure & private'
                ].map((text, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <svg viewBox="0 0 20 20" className="h-5 w-5 text-green-500" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-bold text-[#12244f]/80">{text}</span>
                  </div>
                ))}
                <Link href={applyHref} className="mc-btn-primary mt-4 !bg-[#22c55e] !text-[#12244f] shadow-[#22c55e]/20 hover:!bg-[#22c55e]/90">
                  Check Free Credit Score
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

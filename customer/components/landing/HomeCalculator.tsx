'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';

function formatINR(n: number) {
  return n.toLocaleString('en-IN');
}

export function HomeCalculator() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const sectionRef = useScrollReveal();

  const [amount, setAmount] = useState(10000);
  const [tenure, setTenure] = useState(30);

  const ratePerDay = 0.001;
  const totalInterest = Math.round(amount * ratePerDay * tenure);
  const totalPayable = amount + totalInterest;
  const dailyRepayment = (totalPayable / tenure).toFixed(2);
  const effectiveRate = ((totalInterest / amount) * (365 / tenure) * 100).toFixed(1);

  const amountPct = ((amount - 500) / (50000 - 500)) * 100;
  const tenurePct = ((tenure - 7) / (90 - 7)) * 100;

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#f0f7ff] py-20 lg:py-28">
      {/* Background decoration */}
      <div className="pointer-events-none absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-[#1496f3]/6 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-[#ffc519]/6 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="reveal mb-5 inline-flex items-center gap-2.5 rounded-full bg-[#ffc519]/15 px-4 py-2">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#f59e0b]" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            <span className="text-[0.65rem] font-[900] uppercase tracking-[0.24em] text-[#f59e0b]">
              EMI Calculator
            </span>
          </div>
          <h2 className="reveal text-[clamp(2rem,4.5vw,3.2rem)] font-[900] tracking-tight text-[#12244f] stagger-1">
            Calculate Your{' '}
            <span className="bg-[linear-gradient(135deg,#ffc519,#f0af00)] bg-clip-text text-transparent">Repayment.</span>
          </h2>
          <p className="reveal mx-auto mt-4 max-w-xl text-base font-[600] text-[#12244f]/50 stagger-2">
            Adjust the sliders to see exactly how much you'll pay — no surprises, no hidden fees.
          </p>
        </div>

        {/* Calculator card */}
        <div className="reveal mx-auto max-w-4xl stagger-3">
          <div className="rounded-[36px] border border-[rgba(18,36,79,0.07)] bg-white p-8 shadow-[0_40px_100px_rgba(18,36,79,0.1)] lg:p-12">
            <div className="grid gap-10 lg:grid-cols-2">

              {/* Amount slider */}
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div>
                    <label className="text-[0.68rem] font-[900] uppercase tracking-[0.2em] text-[#12244f]/40">
                      Loan Amount
                    </label>
                    <div className="mt-1 text-3xl font-[900] text-[#12244f]">
                      ₹{formatINR(amount)}
                    </div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1496f3]/10">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#1496f3]" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="relative">
                  <div className="relative h-3 w-full rounded-full bg-[rgba(18,36,79,0.06)]">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#1496f3] to-[#60c3ff]"
                      style={{ width: `${amountPct}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="50000"
                    step="500"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="mc-range-slider absolute inset-0 h-3 w-full cursor-pointer opacity-0"
                    style={{ height: '12px' }}
                  />
                  <div className="absolute -top-1 h-5 w-5 rounded-full border-4 border-white bg-[#1496f3] shadow-[0_4px_12px_rgba(20,150,243,0.4)] transition-transform"
                    style={{ left: `calc(${amountPct}% - 10px)` }}
                  />
                </div>
                <div className="flex justify-between text-[0.62rem] font-[800] uppercase tracking-[0.18em] text-[#12244f]/30">
                  <span>₹500</span>
                  <span>₹50,000</span>
                </div>
                {/* Quick-select buttons */}
                <div className="flex flex-wrap gap-2">
                  {[2000, 5000, 10000, 25000, 50000].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(v)}
                      className={`rounded-xl px-3 py-1.5 text-[0.65rem] font-[800] transition-all ${
                        amount === v
                          ? 'bg-[#1496f3] text-white shadow-sm'
                          : 'bg-[#f0f7ff] text-[#12244f]/50 hover:bg-[#dceeff] hover:text-[#12244f]'
                      }`}
                    >
                      ₹{formatINR(v)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tenure slider */}
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between">
                  <div>
                    <label className="text-[0.68rem] font-[900] uppercase tracking-[0.2em] text-[#12244f]/40">
                      Repayment Period
                    </label>
                    <div className="mt-1 text-3xl font-[900] text-[#ffc519]">{tenure} Days</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffc519]/12">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#f59e0b]" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="relative">
                  <div className="relative h-3 w-full rounded-full bg-[rgba(18,36,79,0.06)]">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#ffc519] to-[#ffdb6b]"
                      style={{ width: `${tenurePct}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="7"
                    max="90"
                    step="1"
                    value={tenure}
                    onChange={(e) => setTenure(Number(e.target.value))}
                    className="mc-range-slider absolute inset-0 h-3 w-full cursor-pointer opacity-0"
                    style={{ height: '12px' }}
                  />
                  <div
                    className="absolute -top-1 h-5 w-5 rounded-full border-4 border-white bg-[#ffc519] shadow-[0_4px_12px_rgba(255,197,25,0.5)] transition-transform"
                    style={{ left: `calc(${tenurePct}% - 10px)` }}
                  />
                </div>
                <div className="flex justify-between text-[0.62rem] font-[800] uppercase tracking-[0.18em] text-[#12244f]/30">
                  <span>7 Days</span>
                  <span>90 Days</span>
                </div>
                {/* Quick-select buttons */}
                <div className="flex flex-wrap gap-2">
                  {[7, 15, 30, 60, 90].map((v) => (
                    <button
                      key={v}
                      onClick={() => setTenure(v)}
                      className={`rounded-xl px-3 py-1.5 text-[0.65rem] font-[800] transition-all ${
                        tenure === v
                          ? 'bg-[#ffc519] text-[#0a1628] shadow-sm'
                          : 'bg-[#fffbeb] text-[#12244f]/50 hover:bg-[#fef3c7] hover:text-[#12244f]'
                      }`}
                    >
                      {v}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="mt-10 rounded-2xl bg-[#f8faff] p-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Daily Repayment', value: `₹${dailyRepayment}`, highlight: false },
                  { label: 'Total Interest', value: `₹${formatINR(totalInterest)}`, highlight: false },
                  { label: 'Total Payable', value: `₹${formatINR(totalPayable)}`, highlight: true },
                  { label: 'Effective Rate', value: `${effectiveRate}% p.a.`, highlight: false },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <span className="text-[0.6rem] font-[800] uppercase tracking-[0.16em] text-[#12244f]/35">{item.label}</span>
                    <span
                      className={`text-xl font-[900] ${item.highlight ? 'text-[#1496f3]' : 'text-[#12244f]'}`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <Link
                href={applyHref}
                className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#12244f] py-5 text-lg font-[900] text-[#ffc519] shadow-[0_16px_40px_rgba(18,36,79,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(18,36,79,0.28)] sm:w-auto sm:px-16"
              >
                Apply for ₹{formatINR(amount)} Now
                <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="currentColor">
                  <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
                </svg>
              </Link>
              <p className="text-[0.65rem] font-[700] text-[#12244f]/35">
                * Indicative calculation. Actual rates may vary based on credit profile.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

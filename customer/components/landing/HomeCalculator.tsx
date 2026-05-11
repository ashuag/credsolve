'use client';

import {useCallback, useState, type FormEvent} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {buildHrefWithSearch} from '@/lib/navigation';
import {useScrollReveal} from '@/lib/hooks/use-scroll-reveal';

function formatINR(n: number) {
  return n.toLocaleString('en-IN');
}

type HomeCalculatorProps = {
  /** Compact card for hero column — no outer section shell or page-level heading */
  embed?: boolean;
};

type HomeCalculatorInnerProps = {
  embed: boolean;
  applyHref: string;
};

/** All loan state + heavy UI — isolated so parent (`useSearchParams`) does not re-render on every drag tick. */
function HomeCalculatorInner({embed, applyHref}: HomeCalculatorInnerProps) {
  const [amount, setAmount] = useState(10000);
  const [tenure, setTenure] = useState(30);

  /** Flat interest: 1% of principal per day of tenure (indicative). */
  const ratePerDay = 0.01;
  const totalInterest = Math.round(amount * ratePerDay * tenure);
  const totalPayable = amount + totalInterest;
  const dailyRepaymentRounded = Math.round(totalPayable / tenure);

  const summaryItems: {key: string; label: string; main: string; sub?: string; featured: boolean}[] = [
    {key: 'daily', label: 'Daily repayment', main: `₹${formatINR(dailyRepaymentRounded)}`, featured: false},
    {key: 'interest', label: 'Total interest', main: `₹${formatINR(totalInterest)}`, featured: false},
    {key: 'payable', label: 'Total payable', main: `₹${formatINR(totalPayable)}`, sub: 'Principal + interest', featured: true},
  ];

  const amountPct = ((amount - 500) / (50000 - 500)) * 100;
  const tenureMin = 7;
  const tenureMax = 45;
  const tenurePct = ((tenure - tenureMin) / (tenureMax - tenureMin)) * 100;

  const onAmountInput = useCallback((e: FormEvent<HTMLInputElement>) => {
    setAmount(Number(e.currentTarget.value));
  }, []);

  const onTenureInput = useCallback((e: FormEvent<HTMLInputElement>) => {
    setTenure(Number(e.currentTarget.value));
  }, []);

  return (
    <div className={`relative z-10 ${embed ? '' : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'}`}>
      {!embed && (
        <div className="mb-12 text-center">
          <div className="reveal mb-5 inline-flex items-center gap-2.5 rounded-full bg-[#ffc519]/15 px-4 py-2">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#f59e0b]" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            <span className="text-[0.65rem] font-[900] uppercase tracking-[0.24em] text-[#f59e0b]">EMI Calculator</span>
          </div>
        </div>
      )}

      <div className={`${embed ? '' : 'reveal mx-auto max-w-4xl stagger-3'}`}>
        <div
          className={`rounded-[36px] border border-[rgba(18,36,79,0.07)] bg-white shadow-[0_40px_100px_rgba(18,36,79,0.1)] ${
            embed
              ? 'rounded-[40px] p-7 shadow-[0_28px_90px_rgba(18,36,79,0.14)] sm:p-8 lg:p-10 xl:p-11'
              : 'p-8 lg:p-12'
          }`}
        >
          {embed && (
            <div className="mb-5 flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#ffc519]/12 px-3 py-1 text-[0.62rem] font-[900] uppercase tracking-[0.2em] text-[#b45309]">
                <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
                Instant estimate
              </span>
            </div>
          )}
          <div className={`grid lg:grid-cols-2 ${embed ? 'gap-12' : 'gap-10'}`}>
            {/* Amount slider */}
            <div className="flex flex-col gap-5">
              <div className="flex items-start justify-between">
                <div>
                  <label className="text-[0.68rem] font-[900] uppercase tracking-[0.2em] text-[#12244f]/40">Loan Amount</label>
                  <div
                    className={`mt-1 font-[900] text-[#12244f] ${embed ? 'text-3xl sm:text-4xl xl:text-[2.5rem] xl:leading-tight' : 'text-3xl'}`}
                  >
                    ₹{formatINR(amount)}
                  </div>
                </div>
                <div
                  className={`flex shrink-0 items-center justify-center rounded-2xl bg-[#1496f3]/10 ${embed ? 'h-14 w-14' : 'h-12 w-12'}`}
                  aria-hidden
                >
                  <span
                    className={`select-none font-black leading-none text-[#1496f3] ${embed ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}
                  >
                    ₹
                  </span>
                </div>
              </div>
              <div className="relative h-12 w-full touch-none select-none">
                <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-[rgba(18,36,79,0.06)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1496f3] to-[#60c3ff]"
                    style={{width: `${amountPct}%`}}
                  />
                </div>
                <input
                  type="range"
                  min={500}
                  max={50000}
                  step={100}
                  value={amount}
                  onInput={onAmountInput}
                  className="mc-range-slider absolute inset-0 z-[1] h-full w-full cursor-grab opacity-0 active:cursor-grabbing"
                  aria-valuemin={500}
                  aria-valuemax={50000}
                  aria-valuenow={amount}
                  aria-label="Loan amount"
                />
                <div
                  className="pointer-events-none absolute top-1/2 z-[2] h-5 w-5 rounded-full border-4 border-white bg-[#1496f3] shadow-[0_4px_12px_rgba(20,150,243,0.4)] will-change-transform"
                  style={{
                    left: `${amountPct}%`,
                    top: '50%',
                    transform: 'translate3d(-50%, -50%, 0)',
                  }}
                />
              </div>
              <div className="flex justify-between text-[0.62rem] font-[800] uppercase tracking-[0.18em] text-[#12244f]/30">
                <span>₹500</span>
                <span>₹50,000</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[10000, 20000, 30000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(v)}
                    className={`rounded-xl px-3 py-1.5 text-[0.65rem] font-[800] transition-colors ${
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
                  <label className="text-[0.68rem] font-[900] uppercase tracking-[0.2em] text-[#12244f]/40">Repayment Period</label>
                  <div
                    className={`mt-1 font-[900] text-[#ffc519] ${embed ? 'text-3xl sm:text-4xl xl:text-[2.5rem] xl:leading-tight' : 'text-3xl'}`}
                  >
                    {tenure} Days
                  </div>
                </div>
                <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-[#ffc519]/12 ${embed ? 'h-14 w-14' : 'h-12 w-12'}`}>
                  <svg
                    viewBox="0 0 24 24"
                    className={`text-[#f59e0b] ${embed ? 'h-7 w-7' : 'h-6 w-6'}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="relative h-12 w-full touch-none select-none">
                <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-[rgba(18,36,79,0.06)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#ffc519] to-[#ffdb6b]"
                    style={{width: `${tenurePct}%`}}
                  />
                </div>
                <input
                  type="range"
                  min={tenureMin}
                  max={tenureMax}
                  step={1}
                  value={tenure}
                  onInput={onTenureInput}
                  className="mc-range-slider absolute inset-0 z-[1] h-full w-full cursor-grab opacity-0 active:cursor-grabbing"
                  aria-valuemin={tenureMin}
                  aria-valuemax={tenureMax}
                  aria-valuenow={tenure}
                  aria-label="Repayment period in days"
                />
                <div
                  className="pointer-events-none absolute top-1/2 z-[2] h-5 w-5 rounded-full border-4 border-white bg-[#ffc519] shadow-[0_4px_12px_rgba(255,197,25,0.5)] will-change-transform"
                  style={{
                    left: `${tenurePct}%`,
                    top: '50%',
                    transform: 'translate3d(-50%, -50%, 0)',
                  }}
                />
              </div>
              <div className="flex justify-between text-[0.62rem] font-[800] uppercase tracking-[0.18em] text-[#12244f]/30">
                <span>7 Days</span>
                <span>45 Days</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[15, 30, 45].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTenure(v)}
                    className={`rounded-xl px-3 py-1.5 text-[0.65rem] font-[800] transition-colors ${
                      tenure === v
                        ? 'bg-[#ffc519] text-[#0a1628] shadow-sm'
                        : 'bg-[#fffbeb] text-[#12244f]/50 hover:bg-[#fef3c7] hover:text-[#12244f]'
                    }`}
                  >
                    {v} days
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className={`rounded-[22px] border border-[#12244f]/[0.07] bg-gradient-to-b from-white to-[#f4f8ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:rounded-3xl ${embed ? 'mt-12 p-4 sm:p-5' : 'mt-10 p-5 sm:p-6'}`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3 lg:gap-4">
              {summaryItems.map((item) => (
                <div
                  key={item.key}
                  className={`flex min-h-[5.5rem] min-w-0 flex-col justify-between gap-1 rounded-2xl border px-3.5 py-3.5 sm:min-h-[6rem] sm:px-4 sm:py-4 ${
                    item.featured
                      ? 'border-[#1496f3]/25 bg-[#eef7ff]/90 shadow-[0_6px_20px_rgba(20,150,243,0.1)]'
                      : 'border-[#12244f]/[0.06] bg-white/90'
                  }`}
                >
                  <span className="text-[0.58rem] font-[800] uppercase leading-snug tracking-[0.12em] text-[#64748b] sm:text-[0.6rem] sm:tracking-[0.14em]">
                    {item.label}
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`block whitespace-nowrap font-[900] tabular-nums tracking-tight text-[#12244f] ${embed ? 'text-base sm:text-lg lg:text-xl xl:text-2xl' : 'text-base sm:text-xl'}`}
                    >
                      {item.main}
                    </span>
                    {item.sub ? (
                      <span className="mt-0.5 block text-[0.62rem] font-[700] leading-tight text-[#64748b] sm:text-[0.65rem]">{item.sub}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`flex flex-col items-stretch gap-3 ${embed ? 'mt-10' : 'mt-8'}`}>
            <Link
              href={applyHref}
              className={`group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#12244f] py-4 text-lg font-[900] text-[#ffc519] shadow-[0_16px_40px_rgba(18,36,79,0.2)] transition-shadow hover:shadow-[0_20px_50px_rgba(18,36,79,0.28)] sm:py-5 sm:text-xl ${embed ? 'sm:px-16' : 'sm:px-14'}`}
            >
              Apply
              <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="currentColor" aria-hidden>
                <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
              </svg>
            </Link>
            <p className="max-w-xl text-center text-[0.65rem] font-[700] leading-relaxed text-[#12244f]/45 sm:mx-auto sm:text-[0.68rem]">
              * Indicative: 1% of principal per day for the chosen tenure. Actual rates may vary by profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeCalculator({embed = false}: HomeCalculatorProps) {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const sectionRef = useScrollReveal();

  const body = <HomeCalculatorInner embed={embed} applyHref={applyHref} />;

  if (embed) {
    return (
      <div ref={sectionRef} className="relative h-full w-full">
        {body}
      </div>
    );
  }

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#f0f7ff] py-20 lg:py-28">
      <>
        <div className="pointer-events-none absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-[#1496f3]/6 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-[#ffc519]/6 blur-[100px]" />
        {body}
      </>
    </section>
  );
}

'use client';

import { useCallback, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';

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

function SegmentedControl({
  options,
  value,
  onChange,
  activeClass,
  inactiveClass,
  variant = 'light',
}: {
  options: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
  activeClass: string;
  inactiveClass: string;
  variant?: 'dark' | 'light';
}) {
  const bg = variant === 'light' ? 'bg-brand-navy/5' : 'bg-black/20';
  return (
    <div className={`flex rounded-xl p-1 ${bg}`} role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg px-2 py-2 text-[0.62rem] font-[800] uppercase tracking-wide transition-all sm:text-[0.65rem] ${
            value === opt.value ? activeClass : inactiveClass
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RangeTrack({
  pct,
  color,
  value,
  min,
  max,
  step,
  onInput,
  ariaLabel,
  variant = 'light',
}: {
  pct: number;
  color: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onInput: (e: FormEvent<HTMLInputElement>) => void;
  ariaLabel: string;
  variant?: 'dark' | 'light';
}) {
  const trackBg = variant === 'light' ? 'bg-brand-navy/8' : 'bg-white/10';
  const thumbBorder = variant === 'light' ? 'border-brand-navy/10' : 'border-white';

  return (
    <div className="relative h-10 w-full touch-none select-none">
      <div className={`pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full ${trackBg}`}>
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={onInput}
        className="mc-range-slider absolute inset-0 z-[1] h-full w-full cursor-grab opacity-0 active:cursor-grabbing"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={ariaLabel}
      />
      <div
        className={`pointer-events-none absolute top-1/2 z-[2] h-4 w-4 rounded-full border-2 shadow-md will-change-transform ${thumbBorder}`}
        style={{
          left: `${pct}%`,
          backgroundColor: color,
          transform: 'translate3d(-50%, -50%, 0)',
        }}
      />
    </div>
  );
}

/** All loan state + heavy UI — isolated so parent (`useSearchParams`) does not re-render on every drag tick. */
function HomeCalculatorInner({ embed, applyHref }: HomeCalculatorInnerProps) {
  const [amount, setAmount] = useState(10000);
  const [tenure, setTenure] = useState(30);

  const ratePerDay = 0.01;
  const totalInterest = Math.round(amount * ratePerDay * tenure);
  const totalPayable = amount + totalInterest;
  const dailyRepaymentRounded = Math.round(totalPayable / tenure);

  const amountPct = ((amount - 500) / (30000 - 500)) * 100;
  const tenureMin = 7;
  const tenureMax = 45;
  const tenurePct = ((tenure - tenureMin) / (tenureMax - tenureMin)) * 100;

  const onAmountInput = useCallback((e: FormEvent<HTMLInputElement>) => {
    setAmount(Number(e.currentTarget.value));
  }, []);

  const onTenureInput = useCallback((e: FormEvent<HTMLInputElement>) => {
    setTenure(Number(e.currentTarget.value));
  }, []);

  if (embed) {
    return (
      <div className="relative w-full overflow-hidden rounded-[36px] bg-white border border-brand-navy/6 shadow-[0_32px_80px_rgba(18,36,79,0.06)]">
        {/* Header — live total */}
        <div className="border-b border-brand-navy/6 px-5 py-5 sm:px-6 sm:py-6 bg-brand-navy/[0.01]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-gold/10 px-2.5 py-1 text-[0.58rem] font-[900] uppercase tracking-[0.18em] text-[#e5a800]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f4b400]" aria-hidden />
                Instant estimate
              </span>
              <p className="mt-3 text-[0.65rem] font-[700] uppercase tracking-[0.16em] text-[#12244f]/40">Total payable</p>
              <p className="mt-0.5 text-[clamp(1.75rem,4vw,2.25rem)] font-[900] tabular-nums tracking-tight text-brand-navy">
                ₹{formatINR(totalPayable)}
              </p>
              <p className="mt-1 text-[0.65rem] font-[600] text-[#12244f]/35">Principal + interest</p>
            </div>
            <div className="shrink-0 rounded-2xl bg-brand-navy/5 px-4 py-3 text-right">
              <p className="text-[0.58rem] font-[800] uppercase tracking-[0.14em] text-[#12244f]/35">Daily</p>
              <p className="text-lg font-[900] tabular-nums text-brand-blue">₹{formatINR(dailyRepaymentRounded)}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
          {/* Amount */}
          <div>
            <div className="mb-3 flex items-end justify-between">
              <label className="text-[0.62rem] font-[900] uppercase tracking-[0.18em] text-[#12244f]/45">Loan amount</label>
              <span className="text-xl font-[900] tabular-nums text-[#12244f]">₹{formatINR(amount)}</span>
            </div>
            <RangeTrack
              pct={amountPct}
              color="#1496f3"
              value={amount}
              min={500}
              max={30000}
              step={100}
              onInput={onAmountInput}
              ariaLabel="Loan amount"
              variant="light"
            />
            <div className="mt-3">
              <SegmentedControl
                options={[
                  { label: '₹10K', value: 10000 },
                  { label: '₹20K', value: 20000 },
                  { label: '₹30K', value: 30000 },
                ]}
                value={amount}
                onChange={setAmount}
                activeClass="bg-brand-blue text-white shadow-sm"
                inactiveClass="text-[#12244f]/45 hover:text-[#12244f]/70"
                variant="light"
              />
            </div>
          </div>

          {/* Tenure */}
          <div>
            <div className="mb-3 flex items-end justify-between">
              <label className="text-[0.62rem] font-[900] uppercase tracking-[0.18em] text-[#12244f]/45">Repayment period</label>
              <span className="text-xl font-[900] tabular-nums text-[#f4b400]">{tenure} days</span>
            </div>
            <RangeTrack
              pct={tenurePct}
              color="#F4B400"
              value={tenure}
              min={tenureMin}
              max={tenureMax}
              step={1}
              onInput={onTenureInput}
              ariaLabel="Repayment period in days"
              variant="light"
            />
            <div className="mt-3">
              <SegmentedControl
                options={[
                  { label: '15d', value: 15 },
                  { label: '30d', value: 30 },
                  { label: '45d', value: 45 },
                ]}
                value={tenure}
                onChange={setTenure}
                activeClass="bg-brand-gold text-brand-navy shadow-sm"
                inactiveClass="text-[#12244f]/45 hover:text-[#12244f]/70"
                variant="light"
              />
            </div>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-brand-navy/6 bg-[#f8fafc] px-3 py-3 text-center sm:px-4 sm:py-4">
              <p className="text-[0.55rem] font-[800] uppercase tracking-[0.1em] text-brand-muted sm:text-[0.58rem]">Daily</p>
              <p className="mt-1 text-sm font-[900] tabular-nums text-brand-navy sm:text-base">₹{formatINR(dailyRepaymentRounded)}</p>
            </div>
            <div className="rounded-2xl border border-brand-navy/6 bg-[#f8fafc] px-3 py-3 text-center sm:px-4 sm:py-4">
              <p className="text-[0.55rem] font-[800] uppercase tracking-[0.1em] text-brand-muted sm:text-[0.58rem]">Interest</p>
              <p className="mt-1 text-sm font-[900] tabular-nums text-brand-navy sm:text-base">₹{formatINR(totalInterest)}</p>
            </div>
            <div className="rounded-2xl border border-[#1496f3]/15 bg-[#f4faff] px-3 py-3 text-center sm:px-4 sm:py-4">
              <p className="text-[0.55rem] font-[800] uppercase tracking-[0.1em] text-[#1496f3] sm:text-[0.58rem]">Total</p>
              <p className="mt-1 text-sm font-[900] tabular-nums text-[#1496f3] sm:text-base">₹{formatINR(totalPayable)}</p>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="border-t border-brand-navy/6 px-5 py-4 sm:px-6 sm:py-5 bg-brand-navy/[0.01]">
          <Link
            href={applyHref}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy py-3.5 text-[0.95rem] font-[900] text-white transition-all hover:bg-[#12244f] active:scale-[0.98]"
          >
            Apply
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#ffc519] transition-transform group-hover:translate-x-0.5" fill="currentColor" aria-hidden>
              <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
            </svg>
          </Link>
          <p className="mt-3 text-center text-[0.6rem] font-[600] leading-relaxed text-[#12244f]/35">
            * Indicative: 1% of principal per day for the chosen tenure. Actual rates may vary by profile.
          </p>
        </div>
      </div>
    );
  }

  /* Standalone section layout (unchanged light theme for non-embed use) */
  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <div className="reveal mb-5 inline-flex items-center gap-2.5 rounded-full bg-brand-gold/15 px-4 py-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#f59e0b]" fill="currentColor" aria-hidden>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          <span className="text-[0.65rem] font-[900] uppercase tracking-[0.24em] text-[#f59e0b]">EMI Calculator</span>
        </div>
      </div>

      <div className="reveal mx-auto max-w-4xl stagger-3">
        <EmbedLightCalculator applyHref={applyHref} />
      </div>
    </div>
  );
}

/** Light-theme calculator for standalone section pages */
function EmbedLightCalculator({ applyHref }: { applyHref: string }) {
  const [amount, setAmount] = useState(10000);
  const [tenure, setTenure] = useState(30);

  const ratePerDay = 0.01;
  const totalInterest = Math.round(amount * ratePerDay * tenure);
  const totalPayable = amount + totalInterest;
  const dailyRepaymentRounded = Math.round(totalPayable / tenure);

  const amountPct = ((amount - 500) / (30000 - 500)) * 100;
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
    <div className="rounded-[36px] border border-brand-navy/7 bg-white p-8 shadow-[0_40px_100px_rgba(18,36,79,0.1)] lg:p-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div>
            <label className="text-[0.68rem] font-[900] uppercase tracking-[0.2em] text-brand-navy/40">Loan Amount</label>
            <div className="mt-1 text-3xl font-[900] text-brand-navy">₹{formatINR(amount)}</div>
          </div>
          <RangeTrack variant="light" pct={amountPct} color="#1496f3" value={amount} min={500} max={30000} step={100} onInput={onAmountInput} ariaLabel="Loan amount" />
        </div>
        <div className="flex flex-col gap-5">
          <div>
            <label className="text-[0.68rem] font-[900] uppercase tracking-[0.2em] text-brand-navy/40">Repayment Period</label>
            <div className="mt-1 text-3xl font-[900] text-brand-gold">{tenure} Days</div>
          </div>
          <RangeTrack variant="light" pct={tenurePct} color="#ffc519" value={tenure} min={tenureMin} max={tenureMax} step={1} onInput={onTenureInput} ariaLabel="Repayment period in days" />
        </div>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-3">
        {[
          { label: 'Daily repayment', value: `₹${formatINR(dailyRepaymentRounded)}` },
          { label: 'Total interest', value: `₹${formatINR(totalInterest)}` },
          { label: 'Total payable', value: `₹${formatINR(totalPayable)}` },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-brand-navy/6 bg-[#f8fafc] px-4 py-3">
            <p className="text-[0.6rem] font-[800] uppercase tracking-[0.12em] text-brand-muted">{item.label}</p>
            <p className="mt-1 text-lg font-[900] text-brand-navy">{item.value}</p>
          </div>
        ))}
      </div>

      <Link
        href={applyHref}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-navy py-4 text-lg font-[900] text-brand-gold"
      >
        Apply
      </Link>
    </div>
  );
}

export function HomeCalculator({ embed = false }: HomeCalculatorProps) {
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
      <div className="pointer-events-none absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-brand-blue/6 blur-[120px]" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-brand-gold/6 blur-[100px]" aria-hidden />
      {body}
    </section>
  );
}

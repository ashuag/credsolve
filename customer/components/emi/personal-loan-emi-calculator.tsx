'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { buildHrefWithSearch } from '@/lib/navigation';

const AMOUNT_MIN = 5_000;
const AMOUNT_MAX = 1_00_00_000; // ₹1 Cr
const AMOUNT_STEP = 5_000;
const RATE_MIN = 8;
const RATE_MAX = 30;
const RATE_STEP = 0.5;
const TENURE_YR_MIN = 1;
const TENURE_YR_MAX = 7;
const TENURE_MO_MIN = 12;
const TENURE_MO_MAX = 84;

const QUICK_AMOUNTS = [
  { label: '₹1L', value: 1_00_000 },
  { label: '₹5L', value: 5_00_000 },
  { label: '₹10L', value: 10_00_000 },
  { label: '₹15L', value: 15_00_000 },
  { label: '₹20L', value: 20_00_000 },
];

function formatINR(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

function formatLakh(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} crore`;
  return `₹${(n / 1_00_000).toFixed(2)} lakh`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Standard reducing-balance EMI:
 * EMI = P · r · (1+r)^n / ((1+r)^n − 1), r = monthly rate, n = months.
 */
function computeEmi(principal: number, yearlyRatePct: number, months: number) {
  const r = yearlyRatePct / 12 / 100;
  const emi =
    r === 0
      ? principal / months
      : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  const totalAmount = emi * months;
  return {
    emi: Math.round(emi),
    totalAmount: Math.round(totalAmount),
    totalInterest: Math.round(totalAmount - principal),
  };
}

function SliderRow({
  value,
  min,
  max,
  step,
  onInput,
  ariaLabel,
  color,
  minLabel,
  maxLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onInput: (v: number) => void;
  ariaLabel: string;
  color: string;
  minLabel: string;
  maxLabel: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const handleInput = useCallback(
    (e: FormEvent<HTMLInputElement>) => onInput(Number(e.currentTarget.value)),
    [onInput],
  );

  return (
    <div>
      <div className="relative h-9 w-full touch-none select-none">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-brand-navy/8">
          <div
            className="h-full rounded-full transition-[width] duration-150"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onInput={handleInput}
          className="mc-range-slider absolute inset-0 z-[1] h-full w-full cursor-grab opacity-0 active:cursor-grabbing"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={ariaLabel}
        />
        <div
          className="pointer-events-none absolute top-1/2 z-[2] h-4 w-4 rounded-full border-2 border-white shadow-md will-change-transform"
          style={{ left: `${pct}%`, backgroundColor: color, transform: 'translate3d(-50%, -50%, 0)' }}
        />
      </div>
      <div className="flex items-center justify-between text-[0.62rem] font-[700] text-[#12244f]/35">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function DonutChart({ interestSharePct }: { interestSharePct: number }) {
  const radius = 34;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const interestLen = (interestSharePct / 100) * circumference;

  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24" role="img" aria-label={`Principal ${Math.round(100 - interestSharePct)}%, interest ${Math.round(interestSharePct)}%`}>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#8b5cf6" strokeWidth={strokeWidth} />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="#f4b400"
        strokeWidth={strokeWidth}
        strokeDasharray={`${interestLen} ${circumference - interestLen}`}
        strokeDashoffset={circumference / 4}
      />
      <circle cx="50" cy="50" r={radius - strokeWidth / 2 - 1} fill="white" />
    </svg>
  );
}

export function PersonalLoanEmiCalculator() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);

  const [amount, setAmount] = useState(5_00_000);
  const [rate, setRate] = useState(10);
  const [tenureMonths, setTenureMonths] = useState(36);
  const [tenureUnit, setTenureUnit] = useState<'mo' | 'yr'>('yr');

  const { emi, totalAmount, totalInterest } = useMemo(
    () => computeEmi(amount, rate, tenureMonths),
    [amount, rate, tenureMonths],
  );
  const interestSharePct = totalAmount > 0 ? (totalInterest / totalAmount) * 100 : 0;
  const interestShareLabel = `${interestSharePct.toFixed(1)}%`;
  const tenureYears = Math.round((tenureMonths / 12) * 10) / 10;

  const onAmountTyped = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.currentTarget.value.replace(/[^0-9]/g, '');
    if (digits === '') {
      setAmount(AMOUNT_MIN);
      return;
    }
    setAmount(clamp(Number(digits), AMOUNT_MIN, AMOUNT_MAX));
  }, []);

  const onRateTyped = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.currentTarget.value);
    if (Number.isFinite(n)) setRate(clamp(n, RATE_MIN, RATE_MAX));
  }, []);

  const onTenureTyped = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.currentTarget.value);
      if (!Number.isFinite(n)) return;
      if (tenureUnit === 'yr') {
        setTenureMonths(clamp(Math.round(n), TENURE_YR_MIN, TENURE_YR_MAX) * 12);
      } else {
        setTenureMonths(clamp(Math.round(n), TENURE_MO_MIN, TENURE_MO_MAX));
      }
    },
    [tenureUnit],
  );

  const tenureDisplayValue = tenureUnit === 'yr' ? Math.round(tenureMonths / 12) : tenureMonths;

  const emiToUse55Pct = interestSharePct <= 25;

  return (
    <div className="grid gap-8">
      {/* ── Calculator + result ── */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* Inputs card */}
        <div className="rounded-[28px] border border-brand-navy/8 bg-white p-6 shadow-[0_24px_60px_rgba(18,36,79,0.07)] sm:p-8">
          <h2 className="text-lg font-[700] tracking-tight text-brand-navy sm:text-xl">
            Calculate Your Personal Loan EMI
          </h2>

          {/* Loan amount */}
          <div className="mt-6 rounded-2xl border border-brand-navy/8 bg-[#fbfdff] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <label htmlFor="emi-amount" className="text-[0.68rem] font-[800] uppercase tracking-[0.12em] text-[#12244f]/45">
                  Enter Loan Amount
                </label>
                <div className="mt-1 flex items-center gap-1 text-xl font-[900] text-brand-navy">
                  <span>₹</span>
                  <input
                    id="emi-amount"
                    inputMode="numeric"
                    value={formatINR(amount)}
                    onChange={onAmountTyped}
                    className="w-36 bg-transparent tabular-nums outline-none"
                    aria-label="Loan amount in rupees"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setAmount(q.value)}
                    className={`rounded-full border px-3 py-1.5 text-[0.7rem] font-[800] transition-colors ${
                      amount === q.value
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'border-brand-navy/12 text-[#12244f]/60 hover:border-brand-blue/50 hover:text-brand-blue'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <SliderRow
                value={amount}
                min={AMOUNT_MIN}
                max={AMOUNT_MAX}
                step={AMOUNT_STEP}
                onInput={setAmount}
                ariaLabel="Loan amount"
                color="#2388E5"
                minLabel="5K"
                maxLabel="1Cr"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Rate of interest */}
            <div className="rounded-2xl border border-brand-navy/8 bg-[#fbfdff] p-4 sm:p-5">
              <label htmlFor="emi-rate" className="text-[0.68rem] font-[800] uppercase tracking-[0.12em] text-[#12244f]/45">
                Rate of Interest <span className="normal-case tracking-normal">(Yearly %)</span>
              </label>
              <input
                id="emi-rate"
                type="number"
                min={RATE_MIN}
                max={RATE_MAX}
                step={RATE_STEP}
                value={rate}
                onChange={onRateTyped}
                className="mt-1 w-full bg-transparent text-xl font-[900] tabular-nums text-brand-navy outline-none"
                aria-label="Yearly interest rate in percent"
              />
              <div className="mt-2">
                <SliderRow
                  value={rate}
                  min={RATE_MIN}
                  max={RATE_MAX}
                  step={RATE_STEP}
                  onInput={setRate}
                  ariaLabel="Yearly interest rate"
                  color="#2388E5"
                  minLabel={`${RATE_MIN}%`}
                  maxLabel={`${RATE_MAX}%`}
                />
              </div>
            </div>

            {/* Tenure */}
            <div className="rounded-2xl border border-brand-navy/8 bg-[#fbfdff] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="emi-tenure" className="text-[0.68rem] font-[800] uppercase tracking-[0.12em] text-[#12244f]/45">
                  Loan Tenure
                </label>
                <div className="flex rounded-full border border-brand-blue/30 p-0.5" role="group" aria-label="Tenure unit">
                  {(['mo', 'yr'] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setTenureUnit(unit)}
                      className={`rounded-full px-3 py-1 text-[0.68rem] font-[800] transition-colors ${
                        tenureUnit === unit ? 'bg-brand-blue text-white' : 'text-brand-blue/70 hover:text-brand-blue'
                      }`}
                    >
                      {unit === 'mo' ? 'Mo' : 'Yr'}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="emi-tenure"
                type="number"
                min={tenureUnit === 'yr' ? TENURE_YR_MIN : TENURE_MO_MIN}
                max={tenureUnit === 'yr' ? TENURE_YR_MAX : TENURE_MO_MAX}
                step={1}
                value={tenureDisplayValue}
                onChange={onTenureTyped}
                className="mt-1 w-full bg-transparent text-xl font-[900] tabular-nums text-brand-navy outline-none"
                aria-label={`Loan tenure in ${tenureUnit === 'yr' ? 'years' : 'months'}`}
              />
              <div className="mt-2">
                <SliderRow
                  value={tenureMonths}
                  min={TENURE_MO_MIN}
                  max={TENURE_MO_MAX}
                  step={tenureUnit === 'yr' ? 12 : 1}
                  onInput={setTenureMonths}
                  ariaLabel="Loan tenure in months"
                  color="#2388E5"
                  minLabel="1y"
                  maxLabel="7y"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Result card */}
        <div className="rounded-[28px] border border-brand-navy/8 bg-white p-6 shadow-[0_24px_60px_rgba(18,36,79,0.07)] sm:p-7">
          <div className="rounded-2xl bg-brand-navy/[0.04] px-5 py-5 text-center">
            <p className="text-[0.78rem] font-[800] text-[#12244f]/60">Your Monthly EMI Payment</p>
            <p className="mt-1 text-[2rem] font-[900] tabular-nums tracking-tight text-brand-navy">
              ₹{formatINR(emi)}
            </p>
          </div>

          <dl className="mt-5 rounded-2xl border border-brand-navy/8 px-5 py-4">
            <div className="flex items-center justify-between py-2">
              <dt className="text-sm font-[600] text-[#12244f]/60">Principal Amount</dt>
              <dd className="text-sm font-[800] tabular-nums text-brand-navy">₹ {formatINR(amount)}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-brand-navy/8 py-2">
              <dt className="text-sm font-[600] text-[#12244f]/60">Interest Amount</dt>
              <dd className="text-sm font-[800] tabular-nums text-brand-navy">₹ {formatINR(totalInterest)}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-[0.95rem] font-[900] text-brand-navy">Total Amount</dt>
              <dd className="text-[0.95rem] font-[900] tabular-nums text-brand-navy">₹ {formatINR(totalAmount)}</dd>
            </div>
          </dl>

          <Link
            href={applyHref}
            className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue py-3.5 text-[0.95rem] font-[900] text-white transition-all hover:bg-[#1c7bd0] active:scale-[0.98]"
          >
            Apply Now
            <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="currentColor" aria-hidden>
              <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── What does this mean? ── */}
      <div>
        <h2 className="text-lg font-[700] tracking-tight text-brand-navy sm:text-xl">What Does This Mean?</h2>
        <p className="mt-1 text-sm text-[#12244f]/55">Your EMI explained in simple language.</p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Plain-language summary */}
          <div className="rounded-[24px] border border-brand-navy/8 bg-white p-5 shadow-[0_16px_44px_rgba(18,36,79,0.05)] sm:p-6">
            <div className="grid grid-cols-3 gap-3 border-b border-brand-navy/8 pb-4">
              <div>
                <p className="text-[0.68rem] font-[700] text-[#12244f]/45">Loan amount</p>
                <p className="mt-0.5 text-sm font-[900] tabular-nums text-brand-navy">₹ {formatINR(amount)}</p>
              </div>
              <div>
                <p className="text-[0.68rem] font-[700] text-[#12244f]/45">Interest rate</p>
                <p className="mt-0.5 text-sm font-[900] tabular-nums text-brand-navy">{rate}% p.a.</p>
              </div>
              <div>
                <p className="text-[0.68rem] font-[700] text-[#12244f]/45">Tenure</p>
                <p className="mt-0.5 text-sm font-[900] tabular-nums text-brand-navy">
                  {tenureYears} yr ({tenureMonths} mo)
                </p>
              </div>
            </div>

            <ul className="mt-4 flex flex-col gap-2.5 text-sm font-[600] leading-relaxed text-[#12244f]/75">
              {[
                `Monthly EMI is ₹ ${formatINR(emi)}`,
                `Total repayment is ${formatLakh(totalAmount)}`,
                `Interest contributes ${interestShareLabel} of total repayment`,
                emiToUse55Pct
                  ? 'Your EMI is well-balanced between principal and interest. Ensure the monthly payment stays within 55% of your net income.'
                  : 'Interest forms a sizeable share of your repayment. A shorter tenure or lower rate can reduce the total interest paid.',
                'Extending tenure may reduce your EMI but increase the total interest paid',
              ].map((text) => (
                <li key={text} className="flex items-start gap-2.5">
                  <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.007 7.006a1 1 0 01-1.414 0L4.296 9.724a1 1 0 111.415-1.414l3.279 3.279 6.3-6.3a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Stats + donut */}
          <div className="rounded-[24px] border border-brand-navy/8 bg-white p-5 shadow-[0_16px_44px_rgba(18,36,79,0.05)] sm:p-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Monthly EMI', value: `₹ ${formatINR(emi)}` },
                { label: 'Total Interest', value: `₹ ${formatINR(totalInterest)}` },
                { label: 'Total Repayment', value: `₹ ${formatINR(totalAmount)}` },
                { label: 'Interest Share', value: interestShareLabel },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-brand-navy/8 bg-[#fbfdff] px-4 py-3">
                  <p className="text-[0.66rem] font-[700] text-[#12244f]/45">{item.label}</p>
                  <p className="mt-0.5 text-sm font-[900] tabular-nums text-brand-navy">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-center gap-6 border-t border-brand-navy/8 pt-5">
              <DonutChart interestSharePct={interestSharePct} />
              <div className="flex flex-col gap-2 text-[0.78rem] font-[700] text-[#12244f]/70">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" aria-hidden />
                  Principal {(100 - interestSharePct).toFixed(0)}%
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f4b400]" aria-hidden />
                  Interest {interestShareLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

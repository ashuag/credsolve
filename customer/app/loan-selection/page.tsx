'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { ApiRequestError } from '@/lib/api/client';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import {
  fetchLoanCalculationSettings,
  fetchLoanEligibility,
  type LoanCalculationSettingsResponse,
} from '@/lib/api/eligibility';
import { saveLoanSelection } from '@/lib/api/lead';
import { CUSTOMER_EMAIL_JOURNEY_PATH } from '@/lib/api/customer-session';
import { saveEmailVerifyHandoff } from '@/lib/email-verify-handoff';
import { CUSTOMER_LOAN_PURPOSE_OPTIONS } from '@/lib/loan-reasons';
import { clearStoredLoanPurpose, readStoredLoanPurpose } from '@/lib/loan-purpose-selection';
import { computeFixedRepaymentDate } from '@/lib/repayment-date';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { Spinner } from '@/components/ui/spinner';

const DEFAULT_LOAN_SETTINGS: LoanCalculationSettingsResponse = {
  minLoanAmount: 2000,
  maxLoanAmount: 30000,
  loanTenureDays: 30,
  roiPerDayPercent: 1,
  processingFeePercent: 2,
  processingFeeGstPercent: 18,
};

function toDateInputValue(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function diffDays(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.max(1, Math.ceil((end - start) / msPerDay));
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

const LOAN_AMOUNT_STEP = 500;

function snapLoanAmount(value: number, min: number, max: number): number {
  const bounded = Math.min(max, Math.max(min, value));
  const stepped = Math.round(bounded / LOAN_AMOUNT_STEP) * LOAN_AMOUNT_STEP;
  return Math.min(max, Math.max(min, stepped));
}

function formatRepaymentDateDisplay(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd} / ${mm} / ${yyyy}`;
}

function RepaymentDateCard({
  repaymentDate,
  tenureDays,
  variant = 'light',
}: {
  repaymentDate: Date;
  tenureDays: number;
  variant?: 'light' | 'dark';
}) {
  const isDark = variant === 'dark';

  return (
    <div
      className={
        isDark
          ? 'rounded-2xl border border-white/20 bg-white/10 p-4'
          : 'bg-slate-50 rounded-2xl p-5 border border-slate-200'
      }
    >
      <div
        className={
          isDark
            ? 'text-[0.75rem] font-bold text-blue-200 uppercase tracking-wider mb-3'
            : 'text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider mb-3'
        }
      >
        Repayment Date
      </div>
      <div
        className={
          isDark
            ? 'rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center'
            : 'rounded-xl border border-slate-200 bg-white px-4 py-3 text-center'
        }
        title="Repayment date is set by policy: 1st–15th → end of this month; 16th onward → end of next month."
      >
        <span className={isDark ? 'text-[1.1rem] font-black text-white' : 'text-[1rem] font-bold text-brand-navy'}>
          {formatRepaymentDateDisplay(repaymentDate)}
        </span>
      </div>
      <div className="mt-3 flex justify-between items-center">
        <span className={isDark ? 'text-[0.8rem] text-white/60' : 'text-[0.8rem] text-slate-500'}>Selected tenure:</span>
        <span className={isDark ? 'text-[0.8rem] font-bold text-white' : 'text-[0.8rem] font-bold text-brand-navy'}>
          {tenureDays} days
        </span>
      </div>
    </div>
  );
}

/** Default slider position: midpoint of min/max, aligned to step. */
function defaultLoanAmount(min: number, max: number): number {
  return snapLoanAmount((min + max) / 2, min, max);
}

export default function LoanSelectionPage() {
  const router = useRouter();
  const { refresh } = useCustomerSession();
  const sessionExpiredHandledRef = useRef(false);
  const [settings, setSettings] = useState<LoanCalculationSettingsResponse>(DEFAULT_LOAN_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [eligibleAmount, setEligibleAmount] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSettings(true);
      try {
        const [next, eligibility] = await Promise.all([
          fetchLoanCalculationSettings(),
          fetchLoanEligibility(),
        ]);
        if (!cancelled) {
          setSettings(next);
          setEligibleAmount(eligibility.preApprovedAmountInr);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.statusCode === 401) {
          if (sessionExpiredHandledRef.current) return;
          sessionExpiredHandledRef.current = true;
          await refresh();
          router.replace('/apply-for-loan');
          return;
        }
        if (e instanceof ApiRequestError && e.statusCode === 403) {
          router.replace('/thank-you-interest');
          return;
        }
        setSettingsError(e instanceof Error ? e.message : 'Unable to load loan settings.');
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, refresh]);

  /** Slider: product floor … up to pre-approved eligible amount (never above product `maxLoanAmount`). */
  const sliderMin = settings.minLoanAmount;
  const sliderMax = Math.max(
    sliderMin,
    eligibleAmount != null
      ? Math.min(eligibleAmount, settings.maxLoanAmount)
      : settings.maxLoanAmount,
  );

  const today = useMemo(() => new Date(), []);
  const fixedRepaymentDate = useMemo(() => computeFixedRepaymentDate(today), [today]);
  const selectedEndDate = useMemo(() => toDateInputValue(fixedRepaymentDate), [fixedRepaymentDate]);

  const [loanPurpose, setLoanPurpose] = useState('');
  const [purposeError, setPurposeError] = useState<string | null>(null);
  const hasInitializedPurpose = useRef(false);

  useEffect(() => {
    if (hasInitializedPurpose.current) return;

    const storedPurpose = readStoredLoanPurpose();
    if (storedPurpose) {
      setLoanPurpose(storedPurpose);
    }
    hasInitializedPurpose.current = true;
  }, []);
  const [selectedAmount, setSelectedAmount] = useState(DEFAULT_LOAN_SETTINGS.minLoanAmount);
  const hasInitializedAmount = useRef(false);

  useEffect(() => {
    if (loadingSettings) return;

    if (!hasInitializedAmount.current) {
      setSelectedAmount(defaultLoanAmount(sliderMin, sliderMax));
      hasInitializedAmount.current = true;
      return;
    }

    setSelectedAmount((prev) => snapLoanAmount(prev, sliderMin, sliderMax));
  }, [sliderMax, sliderMin, loadingSettings]);

  const tenureDays = useMemo(() => {
    return diffDays(today, fixedRepaymentDate);
  }, [today, fixedRepaymentDate]);

  const calculations = useMemo(() => {
    const principal = selectedAmount;
    const interestAmount = principal * (settings.roiPerDayPercent / 100) * tenureDays;
    const processingFeeAmount = (principal * settings.processingFeePercent) / 100;
    const gstOnProcessing = (processingFeeAmount * settings.processingFeeGstPercent) / 100;
    const totalRepaymentAmount = principal + interestAmount;
    const totalDisbursementAmount = principal - processingFeeAmount - gstOnProcessing;

    return {
      principal,
      interestAmount,
      processingFeeAmount,
      gstOnProcessing,
      totalRepaymentAmount,
      totalDisbursementAmount,
    };
  }, [selectedAmount, settings.processingFeeGstPercent, settings.processingFeePercent, settings.roiPerDayPercent, tenureDays]);

  async function handleContinue() {
    if (!loanPurpose.trim()) {
      setPurposeError('Please select a purpose for your loan.');
      return;
    }
    setPurposeError(null);
    setIsSaving(true);
    try {
      await saveLoanSelection({
        loanAmount: selectedAmount,
        tenureEndDate: selectedEndDate,
        loanPurpose,
      });
      clearStoredLoanPurpose();
      const next = await refresh();
      if (next.authenticated && next.lead) {
        saveEmailVerifyHandoff({
          leadUuid: next.lead.uuid,
          email: next.lead.email,
          emailVerified: next.lead.emailVerified,
          mobileNumber: next.mobileNumber,
          loanSelection: next.loanSelection,
        });
      }
      router.replace(CUSTOMER_EMAIL_JOURNEY_PATH);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Unable to save loan selection.');
      setIsSaving(false);
    }
  }

  if (settingsError) {
    return (
      <CustomerJourneyGuard>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="mc-card max-w-md w-full grid gap-4 text-center">
            <div className="mc-chip mx-auto">Error</div>
            <p className="m-0 text-brand-navy font-semibold">{settingsError}</p>
            <Link href="/pre-approved-loan" className="mc-btn-primary">
              Back to Offer
            </Link>
          </div>
        </div>
      </CustomerJourneyGuard>
    );
  }

  const leftInfographic = (
    <div className="w-full max-w-[380px] bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
      <RepaymentDateCard repaymentDate={fixedRepaymentDate} tenureDays={tenureDays} variant="dark" />
      <div className="h-px bg-white/10 my-5" />
      <div className="text-[0.7rem] font-black text-blue-200 uppercase tracking-[0.2em] mb-4">Loan Calculation</div>
      <div className="grid gap-3">
        <SummaryItem label="Principal" value={formatInr(calculations.principal)} />
        <SummaryItem label="Interest" value={formatInr(calculations.interestAmount)} subValue={`${settings.roiPerDayPercent}% per day`} />
        <SummaryItem label="Processing Fee" value={formatInr(calculations.processingFeeAmount)} subValue={`${settings.processingFeePercent}%`} />
        <SummaryItem label="GST (18%)" value={formatInr(calculations.gstOnProcessing)} />
        <div className="h-px bg-white/10 my-2" />
        <div className="flex justify-between items-center">
          <div className="text-white/60 text-[0.8rem] font-bold uppercase">Repayment</div>
          <div className="text-white text-xl font-black">{formatInr(calculations.totalRepaymentAmount)}</div>
        </div>
        <div className="flex justify-between items-center bg-white/10 rounded-xl p-3 border border-white/10">
          <div className="text-blue-200 text-[0.7rem] font-bold uppercase">In-hand Amount</div>
          <div className="text-[#facc15] text-lg font-black">{formatInr(calculations.totalDisbursementAmount)}</div>
        </div>
      </div>
    </div>
  );

  const journeyPanel = (
    <div className="h-full flex flex-col justify-center">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="flex gap-1.5">
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
          </div>
          <span className="ml-3 text-[0.7rem] font-black text-slate-400 uppercase tracking-widest">Step 4 — Selection</span>
        </div>

        <h1 className="text-2xl md:text-[2.2rem] font-extrabold text-brand-navy mb-4 tracking-tight leading-[1.1]">
          Customize your loan.
        </h1>
        <p className="text-[0.95rem] text-slate-500 mb-8 leading-relaxed">
          Choose an amount between your minimum loan and your pre-approved limit. Repayment date follows our schedule
          (month-end rule) and is shown in your loan summary on the left.
        </p>

        <div className="mb-6 lg:hidden">
          <RepaymentDateCard repaymentDate={fixedRepaymentDate} tenureDays={tenureDays} />
        </div>

        <div className="grid gap-6">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
            <div className="flex justify-between items-end mb-4">
              <label className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider">Loan Amount</label>
              <div className="text-xl font-black text-brand-blue">{formatInr(selectedAmount)}</div>
            </div>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={LOAN_AMOUNT_STEP}
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-blue"
            />
            <div className="flex justify-between mt-2 text-[0.65rem] font-bold text-slate-400">
              <span>{formatInr(sliderMin)}</span>
              <span>{formatInr(sliderMax)}</span>
            </div>
          </div>

          <LoanPurposePicker
            value={loanPurpose}
            onChange={(next) => {
              setLoanPurpose(next);
              if (next.trim()) setPurposeError(null);
            }}
            error={purposeError}
          />
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleContinue}
            disabled={isSaving || !loanPurpose.trim()}
            className="mc-btn-primary flex-1 py-4 text-[1rem]"
          >
            {isSaving ? 'Processing...' : 'Confirm Loan Details'}
          </button>
          <Link
            href="/pre-approved-loan"
            className="py-4 px-6 rounded-xl font-bold text-[1rem] text-slate-600 bg-white hover:bg-slate-50 transition-colors text-center border border-slate-200"
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <CustomerJourneyGuard>
      <div className="min-h-screen bg-[linear-gradient(135deg,#f0fdf4,#e6f0ff)] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <LoanLandingShell
          journeyPanel={journeyPanel}
          leftTitle={<>Loan <span className="text-[#60a5fa]">Summary</span></>}
          leftDescription="Review your final loan calculations. We believe in 100% transparency with zero hidden charges."
          leftInfographic={leftInfographic}
        />
      </div>
    </CustomerJourneyGuard>
  );
}

function SummaryItem({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="flex justify-between items-start">
      <div>
        <div className="text-white/60 text-[0.75rem] font-bold uppercase tracking-tight">{label}</div>
        {subValue && <div className="text-white/40 text-[0.6rem] font-medium">{subValue}</div>}
      </div>
      <div className="text-white text-[0.95rem] font-bold">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[rgba(18,36,79,0.08)] bg-[rgba(244,249,255,0.74)] px-3.5 py-3">
      <span className="text-brand-muted text-[0.9rem]">{label}</span>
      <span className={strong ? 'text-brand-navy font-extrabold' : 'text-brand-navy font-semibold'}>{value}</span>
    </div>
  );
}

const LOAN_PURPOSES = CUSTOMER_LOAN_PURPOSE_OPTIONS;

function LoanPurposePicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}) {
  return (
    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
      <div className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider mb-4">
        Purpose of Loan <span className="text-red-500">*</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {LOAN_PURPOSES.map((p) => {
          const active = value === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(active ? '' : p.value)}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 px-1 border text-center transition-all duration-150 ${
                active
                  ? 'border-brand-blue bg-blue-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-brand-blue/40 hover:bg-blue-50/40'
              }`}
            >
              <span className="text-xl leading-none">{p.icon}</span>
              <span className={`text-[0.6rem] font-extrabold uppercase tracking-wide leading-tight ${
                active ? 'text-brand-blue' : 'text-slate-500'
              }`}>
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-3 mb-0 text-[0.85rem] font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}


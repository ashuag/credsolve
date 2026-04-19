'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ApiRequestError } from '@/lib/api/client';
import {
  fetchLoanCalculationSettings,
  fetchLoanEligibility,
  type LoanCalculationSettingsResponse,
} from '@/lib/api/eligibility';
import { saveLoanSelection } from '@/lib/api/lead';
import { Spinner } from '@/components/ui/spinner';

const MIN_LOAN_AMOUNT = 5_000;
const DEFAULT_LOAN_SETTINGS: LoanCalculationSettingsResponse = {
  minLoanAmount: 5000,
  maxLoanAmount: 50000,
  loanTenureDays: 30,
  roiPerDayPercent: 1,
  processingFeePercent: 2,
  processingFeeGstPercent: 18,
};

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function toDateInputValue(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(year, month - 1, day);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
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

export default function LoanSelectionPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<LoanCalculationSettingsResponse>(DEFAULT_LOAN_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [eligibleAmount, setEligibleAmount] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
          router.replace('/apply-for-loan');
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
  }, [router]);

  const maxSelectableAmount = Math.max(
    settings.minLoanAmount,
    Math.min(eligibleAmount ?? settings.maxLoanAmount, settings.maxLoanAmount)
  );

  const today = useMemo(() => new Date(), []);
  const minEndDate = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }, [today]);
  const maxEndDate = useMemo(() => addMonths(today, 2), [today]);

  const [selectedAmount, setSelectedAmount] = useState(Math.min(maxSelectableAmount, 25_000));
  const defaultEndDate = useMemo(() => {
    const bySetting = new Date(today);
    bySetting.setDate(bySetting.getDate() + settings.loanTenureDays);
    const capped = bySetting.getTime() > maxEndDate.getTime() ? maxEndDate : bySetting;
    return toDateInputValue(capped);
  }, [today, settings.loanTenureDays, maxEndDate]);
  const [selectedEndDate, setSelectedEndDate] = useState(defaultEndDate);

  useEffect(() => {
    setSelectedAmount((prev) =>
      Math.min(maxSelectableAmount, Math.max(settings.minLoanAmount, prev))
    );
  }, [maxSelectableAmount, settings.minLoanAmount]);

  useEffect(() => {
    setSelectedEndDate(defaultEndDate);
  }, [defaultEndDate]);

  const tenureDays = useMemo(() => {
    const end = parseDateOnly(selectedEndDate) ?? maxEndDate;
    return diffDays(today, end);
  }, [selectedEndDate, today, maxEndDate]);

  const calculations = useMemo(() => {
    const principal = selectedAmount;
    const interestAmount = principal * (settings.roiPerDayPercent / 100) * tenureDays;
    const processingFeeAmount = (principal * settings.processingFeePercent) / 100;
    const gstOnProcessing = (processingFeeAmount * settings.processingFeeGstPercent) / 100;
    const totalRepaymentAmount = principal + interestAmount + processingFeeAmount + gstOnProcessing;
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

  if (loadingSettings) {
    return (
      <div className="flex min-h-[300px] items-center justify-center gap-3 text-brand-muted">
        <Spinner size={34} />
        <span>Loading loan settings...</span>
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="mc-card grid gap-4">
        <div className="mc-chip">Loan settings</div>
        <p className="m-0 text-brand-navy font-semibold">{settingsError}</p>
        <Link href="/pre-approved-loan" className="mc-btn-secondary self-start">
          Back
        </Link>
      </div>
    );
  }

  async function handleContinue() {
    setIsSaving(true);
    try {
      await saveLoanSelection({
        loanAmount: selectedAmount,
        tenureEndDate: selectedEndDate,
      });
      router.push('/kyc');
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Unable to save loan selection.');
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-[18px] nav:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <section className="mc-card flex flex-col gap-5">
        <div className="mc-chip">Select loan amount</div>
        <h1 className="text-brand-navy text-[clamp(2rem,5vw,3rem)] tracking-[-0.05em] leading-[1.1]">
          Choose your loan.
        </h1>
        <p className="text-brand-muted leading-[1.7]">
          Select an amount between {formatInr(settings.minLoanAmount)} and {formatInr(maxSelectableAmount)}.
        </p>

        <div className="mc-inner-card grid gap-3">
          <label htmlFor="loanAmountRange" className="text-[0.88rem] font-extrabold uppercase tracking-[0.1em] text-brand-blue">
            Loan amount
          </label>
          <input
            id="loanAmountRange"
            type="range"
            min={settings.minLoanAmount}
            max={maxSelectableAmount}
            step={500}
            value={selectedAmount}
            onChange={(e) => setSelectedAmount(Number(e.target.value))}
            className="w-full accent-brand-blue"
          />
          <input
            type="number"
            min={settings.minLoanAmount}
            max={maxSelectableAmount}
            step={500}
            value={selectedAmount}
            onChange={(e) => {
              const value = Number.parseInt(e.target.value, 10);
              if (!Number.isFinite(value)) return;
              setSelectedAmount(
                Math.max(settings.minLoanAmount, Math.min(maxSelectableAmount, value))
              );
            }}
            className="w-full min-h-[52px] px-4 rounded-[16px] border border-[rgba(18,36,79,0.16)] bg-white text-brand-navy text-[1rem] font-bold outline-0"
          />
        </div>

        <div className="mc-inner-card grid gap-3">
          <label htmlFor="loanEndDate" className="text-[0.88rem] font-extrabold uppercase tracking-[0.1em] text-brand-blue">
            Loan tenure end date (within next 2 months)
          </label>
          <input
            id="loanEndDate"
            type="date"
            min={toDateInputValue(minEndDate)}
            max={toDateInputValue(maxEndDate)}
            value={selectedEndDate}
            onChange={(e) => setSelectedEndDate(e.target.value)}
            className="w-full min-h-[52px] px-4 rounded-[16px] border border-[rgba(18,36,79,0.16)] bg-white text-brand-navy text-[1rem] font-bold outline-0"
          />
          <p className="text-[0.9rem] text-brand-muted m-0">
            Selected tenure: <strong className="text-brand-navy">{tenureDays} days</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void handleContinue()} className="mc-btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Continue'}
          </button>
          <Link href="/pre-approved-loan" className="mc-btn-secondary">
            Back
          </Link>
        </div>
      </section>

      <aside className="mc-card">
        <div className="mc-chip">Full calculation</div>
        <h2 className="mt-[14px] mb-[10px] text-brand-navy text-[clamp(1.7rem,4vw,2.3rem)] tracking-[-0.04em]">
          Loan summary.
        </h2>

        <div className="grid gap-2.5">
          <SummaryRow label="Selected loan amount" value={formatInr(calculations.principal)} />
          <SummaryRow label="Selected loan tenure" value={`${tenureDays} days`} />
          <SummaryRow label="ROI (per day)" value={`${settings.roiPerDayPercent}%`} />
          <SummaryRow label="Interest amount" value={formatInr(calculations.interestAmount)} />
          <SummaryRow label="Processing fee" value={`${settings.processingFeePercent}%`} />
          <SummaryRow label="Processing fee amount" value={formatInr(calculations.processingFeeAmount)} />
          <SummaryRow
            label="GST on processing fee"
            value={`${settings.processingFeeGstPercent}% (${formatInr(calculations.gstOnProcessing)})`}
          />
          <SummaryRow label="Total repayment amount" value={formatInr(calculations.totalRepaymentAmount)} strong />
          <SummaryRow label="Total disbursement amount" value={formatInr(calculations.totalDisbursementAmount)} strong />
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="mc-inner-card flex items-center justify-between gap-3">
      <span className="text-brand-muted text-[0.9rem]">{label}</span>
      <span className={strong ? 'text-brand-navy font-extrabold' : 'text-brand-navy font-semibold'}>{value}</span>
    </div>
  );
}


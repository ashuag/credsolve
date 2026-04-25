'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { ApiRequestError } from '@/lib/api/client';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import {
  fetchLoanCalculationSettings,
  fetchLoanEligibility,
  type LoanCalculationSettingsResponse,
} from '@/lib/api/eligibility';
import { saveLoanSelection } from '@/lib/api/lead';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
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

  const { refresh } = useCustomerSession();

  async function handleContinue() {
    setIsSaving(true);
    try {
      await saveLoanSelection({
        loanAmount: selectedAmount,
        tenureEndDate: selectedEndDate,
      });
      await refresh();
      router.push('/kyc/upload-documents');
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
          Adjust the amount and date to fit your needs. Your summary will update instantly on the left.
        </p>

        <div className="grid gap-6">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
            <div className="flex justify-between items-end mb-4">
              <label className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider">Loan Amount</label>
              <div className="text-xl font-black text-brand-blue">{formatInr(selectedAmount)}</div>
            </div>
            <input
              type="range"
              min={settings.minLoanAmount}
              max={maxSelectableAmount}
              step={500}
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-blue"
            />
            <div className="flex justify-between mt-2 text-[0.65rem] font-bold text-slate-400">
              <span>{formatInr(settings.minLoanAmount)}</span>
              <span>{formatInr(maxSelectableAmount)}</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
            <label htmlFor="loanEndDate" className="block text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider mb-3">
              Repayment Date
            </label>
            <input
              id="loanEndDate"
              type="date"
              min={toDateInputValue(minEndDate)}
              max={toDateInputValue(maxEndDate)}
              value={selectedEndDate}
              onChange={(e) => setSelectedEndDate(e.target.value)}
              className="w-full h-[54px] rounded-xl border border-slate-200 bg-white px-4 text-[1rem] font-bold text-brand-navy focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
            />
            <div className="mt-3 flex justify-between items-center">
              <span className="text-[0.8rem] text-slate-500">Selected tenure:</span>
              <span className="text-[0.8rem] font-bold text-brand-navy">{tenureDays} days</span>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleContinue}
            disabled={isSaving}
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
      <LoanLandingShell
        journeyPanel={journeyPanel}
        leftTitle={<>Loan <span className="text-[#60a5fa]">Summary</span></>}
        leftDescription="Review your final loan calculations. We believe in 100% transparency with zero hidden charges."
        leftInfographic={leftInfographic}
      />
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


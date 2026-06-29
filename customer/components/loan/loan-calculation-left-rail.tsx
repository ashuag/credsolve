'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CustomerLoanSelectionSnapshot } from '@/lib/api/customer-session';
import {
  fetchLoanCalculationSettings,
  type LoanCalculationSettingsResponse,
} from '@/lib/api/eligibility';
import {
  computeLoanBreakdown,
  formatLoanInr,
  formatRepaymentDateDisplay,
} from '@/lib/loan-calculation';
import { parseIsoDate } from '@/lib/date-utils';
import { LoanSummaryLeftRail } from './loan-summary-left-rail';

const DEFAULT_SETTINGS: LoanCalculationSettingsResponse = {
  minLoanAmount: 2000,
  maxLoanAmount: 30000,
  loanTenureDays: 30,
  roiPerDayPercent: 1,
  processingFeePercent: 2,
  processingFeeGstPercent: 18,
};

function CalculationRow({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[0.68rem] font-bold uppercase tracking-tight text-white/60">{label}</div>
        {subValue ? <div className="mt-0.5 text-[0.6rem] font-medium text-white/40">{subValue}</div> : null}
      </div>
      <div className="shrink-0 text-right text-[0.9rem] font-bold text-white">{value}</div>
    </div>
  );
}

export function LoanCalculationLeftRail({
  loanSelection,
}: {
  loanSelection: CustomerLoanSelectionSnapshot | null;
}) {
  const [settings, setSettings] = useState<LoanCalculationSettingsResponse>(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;
    fetchLoanCalculationSettings()
      .then((next) => {
        if (active) setSettings(next);
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      active = false;
    };
  }, []);

  const principal = useMemo(() => {
    const raw = loanSelection?.amountInr?.trim();
    if (!raw) return null;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  }, [loanSelection?.amountInr]);

  const tenureDays = loanSelection?.tenureDays ?? null;
  const maturityDate = useMemo(() => {
    const raw = loanSelection?.maturityDate?.trim();
    if (!raw) return null;
    return parseIsoDate(raw);
  }, [loanSelection?.maturityDate]);

  const breakdown = useMemo(() => {
    if (principal == null || tenureDays == null || !Number.isFinite(tenureDays)) return null;
    return computeLoanBreakdown(principal, tenureDays, settings);
  }, [principal, settings, tenureDays]);

  if (!breakdown || !maturityDate) {
    return <LoanSummaryLeftRail loanSelection={loanSelection} />;
  }

  const repaymentDateLabel = formatRepaymentDateDisplay(maturityDate);
  const asOnDateLabel = formatRepaymentDateDisplay(new Date());

  return (
    <div className="w-full max-w-[340px] max-h-full overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-md">
      <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
        <div className="text-[0.68rem] font-bold uppercase tracking-wider text-blue-200">Repayment date</div>
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[1.02rem] font-black leading-none text-white">{repaymentDateLabel}</span>
          <span className="text-[0.72rem] font-bold text-white/65">{Math.round(tenureDays)} days</span>
        </div>
      </div>

      <div className="mt-3 text-[0.65rem] font-black uppercase tracking-[0.14em] text-blue-200">
        Loan calculation
        <span className="ml-1 font-semibold normal-case tracking-normal text-white/45">as on {asOnDateLabel}</span>
      </div>

      <div className="mt-2.5 grid gap-2">
        <CalculationRow label="Principal" value={formatLoanInr(breakdown.principal)} />
        <CalculationRow
          label="Interest"
          value={formatLoanInr(breakdown.interestAmount)}
          subValue={`${settings.roiPerDayPercent}% per day`}
        />
        <CalculationRow
          label="Processing fee"
          value={formatLoanInr(breakdown.processingFeeAmount)}
          subValue={`${settings.processingFeePercent}%`}
        />
        <CalculationRow
          label={`GST (${settings.processingFeeGstPercent}%)`}
          value={formatLoanInr(breakdown.gstOnProcessing)}
        />
        <div className="my-1 h-px bg-white/10" />
        <div className="flex items-center justify-between gap-3">
          <div className="text-[0.72rem] font-bold uppercase text-white/60">Repayment</div>
          <div className="text-[1.15rem] font-black leading-none text-white">
            {formatLoanInr(breakdown.totalRepaymentAmount)}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5">
          <div className="text-[0.68rem] font-bold uppercase text-blue-200">In-hand amount</div>
          <div className="text-[1.05rem] font-black leading-none text-[#facc15]">
            {formatLoanInr(breakdown.totalDisbursementAmount)}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertBanner } from '@/components/ui/alert-banner';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { saveProfessionalDetails } from '@/lib/api/lead';
import { cn } from '@/lib/cn';
import {
  type CustomerOccupationValue,
  usesAnnualFinancialMetric,
  usesMonthlyIncomeMetric,
} from '@/lib/customer-details';
import {
  FORM_FIELD_CLASS,
  FORM_FIELD_NORMAL_CLASS,
  FORM_FIELD_ERROR_CLASS,
  FORM_LABEL_CLASS,
  FORM_INPUT_CLASS,
} from '@/lib/form-styles';
import { useCustomerDetailLookups } from '@/lib/use-customer-detail-lookups';

type FieldErrors = {
  occupation?: string;
  monthlyIncome?: string;
  annualTurnover?: string;
  annualProfit?: string;
};

export function ProfessionalDetailsForm() {
  const router = useRouter();
  const { session, refresh } = useCustomerSession();
  const [occupation, setOccupation] = useState<CustomerOccupationValue | ''>('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [annualTurnover, setAnnualTurnover] = useState('');
  const [annualProfit, setAnnualProfit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { occupationOptions, isLoading: isLoadingLookups } = useCustomerDetailLookups({ enableApiFetch: false });

  const isSelfEmployed = usesAnnualFinancialMetric(occupation || undefined);
  const usesSalary = usesMonthlyIncomeMetric(occupation || undefined);

  useEffect(() => {
    if (!session?.authenticated || !session.profile) {
      return;
    }

    const p = session.profile;
    setOccupation((p.occupation as CustomerOccupationValue) ?? '');
    setMonthlyIncome(p.monthlyIncome ?? '');
    setAnnualTurnover(p.annualTurnover ?? '');
    setAnnualProfit(p.annualProfit ?? '');
  }, [session]);

  function handleOccupationChange(value: CustomerOccupationValue | '') {
    setOccupation(value);
    setMonthlyIncome('');
    setAnnualTurnover('');
    setAnnualProfit('');
    setFieldErrors({});
    if (submitError) setSubmitError('');
  }

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    if (submitError) setSubmitError('');
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!occupation) {
      errors.occupation = 'Please select your occupation.';
    }
    if (usesSalary && (!monthlyIncome || Number(monthlyIncome) <= 0)) {
      errors.monthlyIncome = 'Please enter your monthly income.';
    }
    if (isSelfEmployed) {
      if (!annualTurnover || Number(annualTurnover) <= 0) {
        errors.annualTurnover = 'Please enter your annual turnover.';
      }
      if (!annualProfit || Number(annualProfit) <= 0) {
        errors.annualProfit = 'Please enter your annual profit.';
      }
    }
    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const leadUuid = session?.authenticated ? session.lead?.uuid : undefined;
    setIsSubmitting(true);

    try {
      const response = await saveProfessionalDetails({
        leadUuid,
        occupation: occupation as CustomerOccupationValue,
        ...(usesSalary && monthlyIncome ? { monthlyIncome } : {}),
        ...(isSelfEmployed && annualTurnover ? { annualTurnover } : {}),
        ...(isSelfEmployed && annualProfit ? { annualProfit } : {}),
      });

      await refresh();

      if (response.eligible) {
        const params = new URLSearchParams();
        if (response.approvedAmount) params.set('amount', String(response.approvedAmount));
        if (response.cibilScore) params.set('score', String(response.cibilScore));
        router.push(`/loan-offer?${params.toString()}`);
      } else {
        router.replace('/thank-you');
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to save your details. Please try again.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 items-start mt-2" noValidate>
      <label className={cn(FORM_FIELD_CLASS, fieldErrors.occupation ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS, 'group')}>
        <span className={FORM_LABEL_CLASS}>Occupation</span>
        <select
          className={FORM_INPUT_CLASS}
          name="occupation"
          value={occupation}
          onChange={(e) => handleOccupationChange(e.target.value as CustomerOccupationValue | '')}
          disabled={isLoadingLookups}
          aria-invalid={Boolean(fieldErrors.occupation)}
          aria-describedby={fieldErrors.occupation ? 'occupation-error' : undefined}
          required
        >
          <option value="" disabled>{isLoadingLookups ? 'Loading...' : 'Select occupation'}</option>
          {occupationOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {fieldErrors.occupation && (
          <p id="occupation-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.occupation}</p>
        )}
      </label>

      {usesSalary && (
        <label className={cn(FORM_FIELD_CLASS, fieldErrors.monthlyIncome ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS, 'group')}>
          <span className={FORM_LABEL_CLASS}>
            {occupation === 'salaried' ? 'Monthly salary' : 'Monthly income'}
          </span>
          <input
            className={FORM_INPUT_CLASS}
            type="text"
            name="monthlyIncome"
            inputMode="numeric"
            placeholder="Enter amount in INR"
            value={monthlyIncome}
            onChange={(e) => { setMonthlyIncome(e.target.value.replace(/\D/g, '').slice(0, 12)); clearFieldError('monthlyIncome'); }}
            aria-invalid={Boolean(fieldErrors.monthlyIncome)}
            aria-describedby={fieldErrors.monthlyIncome ? 'monthlyIncome-error' : 'monthlyIncome-help'}
            required
          />
          <span
            id={fieldErrors.monthlyIncome ? undefined : 'monthlyIncome-help'}
            className="text-[0.82rem] leading-[1.55] text-brand-muted"
          >
            {occupation === 'salaried'
              ? 'Your current take-home monthly salary in INR.'
              : 'Your average monthly income in INR.'}
          </span>
          {fieldErrors.monthlyIncome && (
            <p id="monthlyIncome-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.monthlyIncome}</p>
          )}
        </label>
      )}

      {isSelfEmployed && (
        <>
          <label className={cn(FORM_FIELD_CLASS, fieldErrors.annualTurnover ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS, 'group')}>
            <span className={FORM_LABEL_CLASS}>Annual turnover</span>
            <input
              className={FORM_INPUT_CLASS}
              type="text"
              name="annualTurnover"
              inputMode="numeric"
              placeholder="Enter amount in INR"
              value={annualTurnover}
              onChange={(e) => { setAnnualTurnover(e.target.value.replace(/\D/g, '').slice(0, 12)); clearFieldError('annualTurnover'); }}
              aria-invalid={Boolean(fieldErrors.annualTurnover)}
              aria-describedby={fieldErrors.annualTurnover ? 'annualTurnover-error' : 'annualTurnover-help'}
              required
            />
            <span
              id={fieldErrors.annualTurnover ? undefined : 'annualTurnover-help'}
              className="text-[0.82rem] leading-[1.55] text-brand-muted"
            >
              Your latest annual business turnover in INR.
            </span>
            {fieldErrors.annualTurnover && (
              <p id="annualTurnover-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.annualTurnover}</p>
            )}
          </label>

          <label className={cn(FORM_FIELD_CLASS, fieldErrors.annualProfit ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS, 'group')}>
            <span className={FORM_LABEL_CLASS}>Annual profit</span>
            <input
              className={FORM_INPUT_CLASS}
              type="text"
              name="annualProfit"
              inputMode="numeric"
              placeholder="Enter amount in INR"
              value={annualProfit}
              onChange={(e) => { setAnnualProfit(e.target.value.replace(/\D/g, '').slice(0, 12)); clearFieldError('annualProfit'); }}
              aria-invalid={Boolean(fieldErrors.annualProfit)}
              aria-describedby={fieldErrors.annualProfit ? 'annualProfit-error' : 'annualProfit-help'}
              required
            />
            <span
              id={fieldErrors.annualProfit ? undefined : 'annualProfit-help'}
              className="text-[0.82rem] leading-[1.55] text-brand-muted"
            >
              Your latest annual profit in INR.
            </span>
            {fieldErrors.annualProfit && (
              <p id="annualProfit-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.annualProfit}</p>
            )}
          </label>
        </>
      )}

      {submitError && <AlertBanner variant="error">{submitError}</AlertBanner>}

      <button type="submit" className="mc-btn-primary w-full mt-2" disabled={isSubmitting}>
        {isSubmitting ? 'Checking eligibility...' : 'Save & check eligibility'}
      </button>
    </form>
  );
}

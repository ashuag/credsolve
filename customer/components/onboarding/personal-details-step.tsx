'use client';

import {type ChangeEvent, type ReactNode, startTransition, type SubmitEvent, useEffect, useState,} from 'react';
import {useRouter} from 'next/navigation';
import {CreditBureauPoweredBy} from '@/components/account/credit-bureau-powered-by';
import {AlertBanner} from '@/components/ui/alert-banner';
import {DatePickerField} from '@/components/ui/date-picker-field';
import {FlowLoader} from '@/components/ui/flow-loader';
import {SearchableCityInput} from '@/components/ui/searchable-city-input';
import type {CustomerPortalProfile} from '@/lib/api/customer-session';
import {saveLeadDetails} from '@/lib/api/lead';
import {cn} from '@/lib/cn';
import {
  CUSTOMER_CREDIT_CONSENT_TEXT,
  type CustomerGenderValue,
  type CustomerOccupationValue,
  usesAnnualFinancialMetric,
  usesMonthlyIncomeMetric,
} from '@/lib/customer-details';
import {formatDateDisplay, formatDateIso, getAge, parseDobDisplay, parseIsoDate,} from '@/lib/date-utils';
import {useCustomerDetailLookups} from '@/lib/use-customer-detail-lookups';
import {PINCODE_REGEX} from '@/lib/validators';

const SECTION_CLASS =
  'grid gap-3 rounded-[24px] border border-[rgba(18,36,79,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,249,255,0.94))] p-4 shadow-[0_14px_28px_rgba(23,44,113,0.08)] sm:p-5';
const DETAILS_DRAFT_KEY_PREFIX = 'mc:details:draft:';

type Fields = {
  fullName: string;
  gender: CustomerGenderValue | '';
  dob: string; // YYYY-MM-DD ISO, derived from dobDisplay
  occupation: CustomerOccupationValue | '';
  addressLine1: string;
  addressLine2: string;
  currentCity: string;
  pincode: string;
  monthlyIncome: string;
  annualTurnover: string;
  annualProfit: string;
  creditConsentAccepted: boolean;
};

type FieldError = Partial<Record<keyof Fields, string>>;
export type PersonalDetailsSection = 'profile' | 'financial';

/** Fields collected on part 1 (profile + income after occupation). */
const PROFILE_PAGE_FIELDS: Array<keyof Fields> = [
  'fullName',
  'gender',
  'dob',
  'occupation',
  'monthlyIncome',
  'annualTurnover',
  'annualProfit',
];

type PersonalDetailsStepProps = {
  email: string;
  leadUuid: string;
  initialProfile: CustomerPortalProfile | null;
  onSaved: () => void | Promise<void>;
  activeSection: PersonalDetailsSection;
  onSectionChange: (section: PersonalDetailsSection) => void;
  onBack: () => void;
  noticeMessage?: string | null;
};

function pickErrors(errors: FieldError, fields: Array<keyof Fields>): FieldError {
  const result: FieldError = {};
  for (const f of fields) {
    if (errors[f]) result[f] = errors[f];
  }
  return result;
}

function hasErrors(errors: FieldError, fields: Array<keyof Fields>): boolean {
  return fields.some((f) => Boolean(errors[f]));
}

export function PersonalDetailsStep({
  email,
  leadUuid,
  initialProfile,
  onSaved,
  activeSection,
  onSectionChange,
  onBack,
  noticeMessage,
}: PersonalDetailsStepProps) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>({
    fullName: '',
    gender: '',
    dob: '',
    occupation: '',
    addressLine1: '',
    addressLine2: '',
    currentCity: '',
    pincode: '',
    monthlyIncome: '',
    annualTurnover: '',
    annualProfit: '',
    creditConsentAccepted: false,
  });
  // Display value DD/MM/YYYY; fields.dob holds YYYY-MM-DD
  const [dobDisplay, setDobDisplay] = useState('');
  const [errors, setErrors] = useState<FieldError>({});
  const [isNavigating, setIsNavigating] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { cityOptions, genderOptions, occupationOptions, isLoading: isLoadingLookups } = useCustomerDetailLookups();

  // Build the max-selectable date: must be 18+ years old
  const maxDob = new Date();
  maxDob.setFullYear(maxDob.getFullYear() - 18);

  const isSelfEmployed = usesAnnualFinancialMetric(fields.occupation || undefined);
  const usesMonthlyIncome = usesMonthlyIncomeMetric(fields.occupation || undefined);
  const draftStorageKey = `${DETAILS_DRAFT_KEY_PREFIX}${leadUuid}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { fields?: Fields; dobDisplay?: string };
      if (parsed.fields) {
        setFields((prev) => ({ ...prev, ...parsed.fields }));
      }
      if (typeof parsed.dobDisplay === 'string') {
        setDobDisplay(parsed.dobDisplay);
      }
    } catch {
      // Ignore bad draft data and continue with server/session values.
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!initialProfile) {
      return;
    }

    const p = initialProfile;
    setFields((prev) => ({
      fullName: p.fullName ?? prev.fullName,
      gender: (p.gender as Fields['gender']) || prev.gender,
      dob: p.dob ?? prev.dob,
      occupation: (p.occupation as Fields['occupation']) || prev.occupation,
      addressLine1: p.addressLine1 ?? prev.addressLine1,
      addressLine2: p.addressLine2 ?? prev.addressLine2,
      currentCity: p.currentCity ?? prev.currentCity,
      pincode: p.pincode ?? prev.pincode,
      monthlyIncome: p.monthlyIncome ?? prev.monthlyIncome,
      annualTurnover: p.annualTurnover ?? prev.annualTurnover,
      annualProfit: p.annualProfit ?? prev.annualProfit,
      creditConsentAccepted: p.creditConsentAccepted ?? prev.creditConsentAccepted,
    }));

    const storedDate = p.dob ? parseIsoDate(p.dob) : null;
    if (storedDate) setDobDisplay(formatDateDisplay(storedDate));
  }, [initialProfile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          fields,
          dobDisplay,
        })
      );
    } catch {
      // Best effort only.
    }
  }, [draftStorageKey, fields, dobDisplay]);

  function handleDobChange(displayValue: string) {
    setDobDisplay(displayValue);
    const parsed = parseDobDisplay(displayValue);
    setFields((prev) => ({ ...prev, dob: parsed ? formatDateIso(parsed) : '' }));
    if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
    if (submitError) setSubmitError('');
  }

  function setField(key: Exclude<keyof Fields, 'creditConsentAccepted'>) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      let value = event.target.value;

      if (key === 'monthlyIncome' || key === 'annualTurnover' || key === 'annualProfit') {
        value = value.replace(/\D/g, '').slice(0, 12);
      }
      if (key === 'pincode') {
        value = value.replace(/\D/g, '').slice(0, 6);
      }

      setFields((prev) => {
        const next = { ...prev, [key]: value } as Fields;
        if (key === 'occupation') {
          const occ = value as CustomerOccupationValue | '';
          if (usesAnnualFinancialMetric(occ || undefined)) {
            next.monthlyIncome = '';
          } else if (usesMonthlyIncomeMetric(occ || undefined)) {
            next.annualTurnover = '';
            next.annualProfit = '';
          } else {
            next.monthlyIncome = '';
            next.annualTurnover = '';
            next.annualProfit = '';
          }
        }
        return next;
      });

      if (submitError) setSubmitError('');
      if (key === 'occupation') {
        setErrors((prev) => ({
          ...prev,
          occupation: undefined,
          monthlyIncome: undefined,
          annualTurnover: undefined,
          annualProfit: undefined,
        }));
      } else if (errors[key]) {
        setErrors((prev) => ({ ...prev, [key]: undefined }));
      }
    };
  }

  function setConsent(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.checked;
    setFields((prev) => ({ ...prev, creditConsentAccepted: next }));
    if (submitError) setSubmitError('');
    if (errors.creditConsentAccepted && next) setErrors((prev) => ({ ...prev, creditConsentAccepted: undefined }));
  }

  function validate(): FieldError {
    const today = new Date();
    const next: FieldError = {};

    if (!fields.fullName.trim() || fields.fullName.trim().length < 2) {
      next.fullName = 'Please enter your full name.';
    }
    if (!dobDisplay.trim()) {
      next.dob = 'Please enter your date of birth.';
    } else if (!parseDobDisplay(dobDisplay) || parseDobDisplay(dobDisplay)! > today) {
      next.dob = 'Please enter a valid date of birth.';
    } else if (!Number.isFinite(getAge(fields.dob))) {
      next.dob = 'Please enter a valid date of birth.';
    } else if (getAge(fields.dob) < 18) {
      next.dob = 'You must be at least 18 years old to apply.';
    }
    if (!fields.gender) next.gender = 'Please select your gender.';
    if (!fields.occupation) next.occupation = 'Please select your occupation.';
    if (!fields.addressLine1.trim() || fields.addressLine1.trim().length < 5) {
      next.addressLine1 = 'Please enter your address line 1.';
    }
    if (!fields.currentCity.trim()) next.currentCity = 'Please enter your current city.';
    if (!PINCODE_REGEX.test(fields.pincode)) next.pincode = 'Please enter a valid 6-digit pincode.';
    if (usesMonthlyIncome && (!fields.monthlyIncome || Number(fields.monthlyIncome) <= 0)) {
      next.monthlyIncome = 'Please enter your monthly income.';
    }
    if (isSelfEmployed) {
      if (!fields.annualTurnover || Number(fields.annualTurnover) <= 0) next.annualTurnover = 'Please enter your annual turnover.';
      if (!fields.annualProfit || Number(fields.annualProfit) <= 0) next.annualProfit = 'Please enter your annual profit.';
    }
    if (!fields.creditConsentAccepted) next.creditConsentAccepted = 'Please accept the consent declaration to continue.';

    return next;
  }

  function handleContinueToFinancial() {
    const validation = validate();
    const sectionErrors = pickErrors(validation, PROFILE_PAGE_FIELDS);
    if (Object.keys(sectionErrors).length > 0) { setErrors(sectionErrors); return; }
    setErrors((prev) => ({
      ...prev,
      fullName: undefined,
      gender: undefined,
      dob: undefined,
      occupation: undefined,
      monthlyIncome: undefined,
      annualTurnover: undefined,
      annualProfit: undefined,
    }));
    setSubmitError('');
    onSectionChange('financial');
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      onSectionChange(hasErrors(validation, PROFILE_PAGE_FIELDS) ? 'profile' : 'financial');
      return;
    }

    setSubmitError('');
    setIsNavigating(true);

    try {
      await saveLeadDetails({
        leadUuid,
        fullName: fields.fullName.trim(),
        dob: fields.dob,
        gender: fields.gender as CustomerGenderValue,
        occupation: fields.occupation as CustomerOccupationValue,
        addressLine1: fields.addressLine1.trim(),
        ...(fields.addressLine2.trim() ? { addressLine2: fields.addressLine2.trim() } : {}),
        currentCity: fields.currentCity.trim(),
        pincode: fields.pincode,
        ...(fields.monthlyIncome ? { monthlyIncome: fields.monthlyIncome } : {}),
        ...(fields.annualTurnover ? { annualTurnover: fields.annualTurnover } : {}),
        ...(fields.annualProfit ? { annualProfit: fields.annualProfit } : {}),
        creditConsentAccepted: fields.creditConsentAccepted,
      });

      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // Ignore storage cleanup failures.
      }

      await onSaved();

      startTransition(() => router.push('/pre-approved-loan'));
    } catch (err) {
      setIsNavigating(false);
      setSubmitError(err instanceof Error ? err.message : 'Unable to save your details right now. Please try again.');
    }
  }

  return (
    <>
      <section className="h-full flex flex-col justify-center py-4" aria-labelledby="details-heading">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex gap-1.5">
              <div className="h-2 w-8 rounded-full bg-blue-600"></div>
              <div className="h-2 w-8 rounded-full bg-blue-600"></div>
              <div className="h-2 w-8 rounded-full bg-slate-100"></div>
            </div>
            <span className="ml-3 text-[0.7rem] font-black text-slate-400 uppercase tracking-widest">Step 2 — Profile</span>
          </div>

          <h2
            id="details-heading"
            className="text-2xl md:text-[1.8rem] font-extrabold text-brand-navy mb-6 tracking-tight leading-[1.1] whitespace-nowrap"
          >
            Complete Your <span className="text-brand-blue">Profile</span> ✨
          </h2>

          <div className="flex items-start gap-4 p-4 mb-0 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100/60 shadow-sm">
            <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-[0.95rem] text-slate-600 leading-relaxed m-0 pt-0.5">
              Please provide your personal and financial details to complete your loan profile.
            </p>
          </div>
        </div>

        {noticeMessage && (
          <div className="mb-4">
            <AlertBanner variant="success">{noticeMessage}</AlertBanner>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 mt-2" noValidate>
          {activeSection === 'profile' ? (
            <div className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                <div className="md:col-span-2">
                  <FieldGroup label="Full name" htmlFor="fullName" error={errors.fullName}>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      placeholder="XXX YYY"
                      required
                      value={fields.fullName}
                      onChange={setField('fullName')}
                      aria-invalid={Boolean(errors.fullName)}
                      aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                      className={inputClass(Boolean(errors.fullName))}
                    />
                  </FieldGroup>
                </div>

                <FieldGroup label="Gender" htmlFor="gender" error={errors.gender}>
                  <select
                    id="gender"
                    name="gender"
                    value={fields.gender}
                    onChange={setField('gender')}
                    disabled={isLoadingLookups}
                    aria-invalid={Boolean(errors.gender)}
                    aria-describedby={errors.gender ? 'gender-error' : undefined}
                    className={inputClass(Boolean(errors.gender))}
                  >
                    <option value="">{isLoadingLookups ? 'Loading gender...' : 'Select gender'}</option>
                    {genderOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FieldGroup>

                <FieldGroup label="Date of birth" htmlFor="dob" error={errors.dob}>
                  <DatePickerField
                    id="dob"
                    name="dob"
                    label="Date of birth"
                    showInputLabel={false}
                    value={dobDisplay}
                    onChange={handleDobChange}
                    maxDate={maxDob}
                    hint=""
                    ariaInvalid={Boolean(errors.dob)}
                    ariaDescribedBy={errors.dob ? 'dob-error' : undefined}
                  />
                </FieldGroup>

                <div className="md:col-span-2">
                  <FieldGroup label="Occupation" htmlFor="occupation" error={errors.occupation}>
                    <select
                      id="occupation"
                      name="occupation"
                      value={fields.occupation}
                      onChange={setField('occupation')}
                      disabled={isLoadingLookups}
                      aria-invalid={Boolean(errors.occupation)}
                      aria-describedby={errors.occupation ? 'occupation-error' : undefined}
                      className={inputClass(Boolean(errors.occupation))}
                    >
                      <option value="">{isLoadingLookups ? 'Loading occupations...' : 'Select occupation'}</option>
                      {occupationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </FieldGroup>
                </div>

                {usesMonthlyIncome && (
                  <div className="md:col-span-2">
                    <FieldGroup
                      label={fields.occupation === 'salaried' ? 'Monthly salary' : 'Monthly income'}
                      htmlFor="monthlyIncome"
                      error={errors.monthlyIncome}
                    >
                      <input
                        id="monthlyIncome"
                        name="monthlyIncome"
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter amount in INR"
                        required
                        value={fields.monthlyIncome}
                        onChange={setField('monthlyIncome')}
                        aria-invalid={Boolean(errors.monthlyIncome)}
                        aria-describedby={errors.monthlyIncome ? 'monthlyIncome-error' : undefined}
                        className={inputClass(Boolean(errors.monthlyIncome))}
                      />
                    </FieldGroup>
                  </div>
                )}

                {isSelfEmployed && (
                  <>
                    <FieldGroup label="Annual turnover" htmlFor="annualTurnover" error={errors.annualTurnover}>
                      <input
                        id="annualTurnover"
                        name="annualTurnover"
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter amount in INR"
                        required
                        value={fields.annualTurnover}
                        onChange={setField('annualTurnover')}
                        aria-invalid={Boolean(errors.annualTurnover)}
                        aria-describedby={errors.annualTurnover ? 'annualTurnover-error' : undefined}
                        className={inputClass(Boolean(errors.annualTurnover))}
                      />
                    </FieldGroup>

                    <FieldGroup label="Annual profit" htmlFor="annualProfit" error={errors.annualProfit}>
                      <input
                        id="annualProfit"
                        name="annualProfit"
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter amount in INR"
                        required
                        value={fields.annualProfit}
                        onChange={setField('annualProfit')}
                        aria-invalid={Boolean(errors.annualProfit)}
                        aria-describedby={errors.annualProfit ? 'annualProfit-error' : undefined}
                        className={inputClass(Boolean(errors.annualProfit))}
                      />
                    </FieldGroup>
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={onBack} className="py-3 px-4 rounded-xl font-bold text-[0.95rem] text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors text-center border border-slate-200">
                  ← Back
                </button>
                <button type="button" onClick={handleContinueToFinancial} className="mc-btn-primary flex-1">
                  Continue to address
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                <div className="md:col-span-2">
                  <FieldGroup label="Address line 1" htmlFor="addressLine1" error={errors.addressLine1}>
                    <input
                      id="addressLine1"
                      name="addressLine1"
                      type="text"
                      autoComplete="address-line1"
                      placeholder="Flat / House no, Building, Street"
                      required
                      value={fields.addressLine1}
                      onChange={setField('addressLine1')}
                      aria-invalid={Boolean(errors.addressLine1)}
                      aria-describedby={errors.addressLine1 ? 'addressLine1-error' : undefined}
                      className={inputClass(Boolean(errors.addressLine1))}
                    />
                  </FieldGroup>
                </div>

                <div className="md:col-span-2">
                  <FieldGroup label="Address line 2" htmlFor="addressLine2" error={errors.addressLine2}>
                    <input
                      id="addressLine2"
                      name="addressLine2"
                      type="text"
                      autoComplete="address-line2"
                      placeholder="Landmark / Area / Apartment name"
                      value={fields.addressLine2}
                      onChange={setField('addressLine2')}
                      aria-invalid={Boolean(errors.addressLine2)}
                      aria-describedby={errors.addressLine2 ? 'addressLine2-error' : undefined}
                      className={inputClass(Boolean(errors.addressLine2))}
                    />
                  </FieldGroup>
                </div>

                <FieldGroup label="City" htmlFor="currentCity" error={errors.currentCity}>
                  <SearchableCityInput
                    id="currentCity"
                    name="currentCity"
                    value={fields.currentCity}
                    options={cityOptions}
                    onChange={(value) => {
                      setFields((prev) => ({ ...prev, currentCity: value }));
                      if (errors.currentCity) setErrors((prev) => ({ ...prev, currentCity: undefined }));
                    }}
                    className={inputClass(Boolean(errors.currentCity))}
                    placeholder="Start typing your city"
                    isLoading={isLoadingLookups}
                    ariaInvalid={Boolean(errors.currentCity)}
                    ariaDescribedBy={errors.currentCity ? 'currentCity-error' : undefined}
                  />
                </FieldGroup>

                <FieldGroup label="Pincode" htmlFor="pincode" error={errors.pincode}>
                  <input
                    id="pincode"
                    name="pincode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="400001"
                    maxLength={6}
                    required
                    value={fields.pincode}
                    onChange={setField('pincode')}
                    aria-invalid={Boolean(errors.pincode)}
                    aria-describedby={errors.pincode ? 'pincode-error' : undefined}
                    className={inputClass(Boolean(errors.pincode))}
                  />
                </FieldGroup>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="creditConsentAccepted"
                    name="creditConsentAccepted"
                    type="checkbox"
                    checked={fields.creditConsentAccepted}
                    onChange={setConsent}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[0.85rem] leading-relaxed text-slate-600">{CUSTOMER_CREDIT_CONSENT_TEXT}</span>
                </label>
                {errors.creditConsentAccepted && (
                  <p id="creditConsentAccepted-error" className="mt-2 text-[#b2372d] text-sm font-medium">
                    {errors.creditConsentAccepted}
                  </p>
                )}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <CreditBureauPoweredBy />
                </div>
              </div>

              {submitError && <AlertBanner variant="error">{submitError}</AlertBanner>}

              <div className="mt-6 flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onSectionChange('profile')}
                  className="py-3 px-4 rounded-xl font-bold text-[0.95rem] text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors text-center border border-slate-200"
                >
                  ← Back
                </button>
                <button type="submit" className="mc-btn-primary flex-1" disabled={isNavigating}>
                  {isNavigating ? 'Submitting...' : 'Complete application'}
                </button>
              </div>
            </div>
          )}
        </form>
      </section>

      {isNavigating && (
        <FlowLoader
          eyebrow="Almost there"
          title="Saving your details"
          description="We are securely saving your information and preparing your MoneyCash account."
          steps={['Validating details', 'Running consent checks', 'Opening your account']}
        />
      )}
    </>
  );
}

/* ── Local sub-components ─────────────────────────────────────────────────── */

function inputClass(hasError: boolean): string {
  return cn(
    'w-full h-[48px] rounded-xl border px-3',
    'bg-white text-slate-900 text-[0.95rem] font-semibold outline-none transition-all',
    'placeholder:text-slate-400 placeholder:font-normal',
    'focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm',
    hasError ? 'border-red-400 focus:ring-red-500/10' : 'border-slate-200'
  );
}

type FieldGroupProps = {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
};

function FieldGroup({ label, htmlFor, error, children }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={htmlFor} className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider pl-1">
        {label}
      </label>
      {children}
      {error && <p id={`${htmlFor}-error`} className="text-[#b2372d] text-[0.75rem] pl-1 font-medium m-0">{error}</p>}
    </div>
  );
}

'use client';

import {
  startTransition,
  useEffect,
  useState,
  type ChangeEvent,
  type SubmitEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { CreditBureauPoweredBy } from '@/components/account/credit-bureau-powered-by';
import { AlertBanner } from '@/components/ui/alert-banner';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { FlowLoader } from '@/components/ui/flow-loader';
import { SearchableCityInput } from '@/components/ui/searchable-city-input';
import { saveLeadDetails } from '@/lib/api/lead';
import { cn } from '@/lib/cn';
import {
  CUSTOMER_CREDIT_CONSENT_TEXT,
  usesAnnualFinancialMetric,
  usesMonthlyIncomeMetric,
  type CustomerGenderValue,
  type CustomerOccupationValue,
} from '@/lib/customer-details';
import {
  formatDateDisplay,
  formatDateIso,
  getAge,
  parseIsoDate,
  parseDobDisplay,
} from '@/lib/date-utils';
import {
  readCustomerOnboardingState,
  updateCustomerOnboardingState,
} from '@/lib/stores/customer-onboarding-store';
import { useCustomerDetailLookups } from '@/lib/use-customer-detail-lookups';
import { PINCODE_REGEX } from '@/lib/validators';

const SECTION_CLASS =
  'grid gap-4 rounded-[24px] border border-[rgba(18,36,79,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,249,255,0.94))] p-4 shadow-[0_14px_28px_rgba(23,44,113,0.08)] sm:p-5';

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

const PROFILE_FIELDS: Array<keyof Fields> = ['fullName', 'gender', 'dob', 'occupation'];

type PersonalDetailsStepProps = {
  email: string;
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

  useEffect(() => {
    const stored = readCustomerOnboardingState();
    if (!stored) return;

    setFields((prev) => ({
      fullName: stored.fullName || prev.fullName,
      gender: stored.gender || prev.gender,
      dob: stored.dob || prev.dob,
      occupation: stored.occupation || prev.occupation,
      addressLine1: stored.addressLine1 || prev.addressLine1,
      addressLine2: stored.addressLine2 || prev.addressLine2,
      currentCity: stored.currentCity || prev.currentCity,
      pincode: stored.pincode || prev.pincode,
      monthlyIncome: stored.monthlyIncome || (stored.occupation === 'salaried' ? stored.incomeAmount || prev.monthlyIncome : prev.monthlyIncome),
      annualTurnover: stored.annualTurnover || prev.annualTurnover,
      annualProfit: stored.annualProfit || prev.annualProfit,
      creditConsentAccepted: stored.creditConsentAccepted ?? prev.creditConsentAccepted,
    }));

    const storedDate = stored.dob ? parseIsoDate(stored.dob) : null;
    if (storedDate) setDobDisplay(formatDateDisplay(storedDate));
  }, []);

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
    const sectionErrors = pickErrors(validation, PROFILE_FIELDS);
    if (Object.keys(sectionErrors).length > 0) { setErrors(sectionErrors); return; }
    setErrors((prev) => ({ ...prev, fullName: undefined, gender: undefined, dob: undefined, occupation: undefined }));
    setSubmitError('');
    onSectionChange('financial');
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validate();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      onSectionChange(hasErrors(validation, PROFILE_FIELDS) ? 'profile' : 'financial');
      return;
    }

    const currentSession = readCustomerOnboardingState();
    const currentLeadUuid = currentSession?.leadUuid?.trim();

    updateCustomerOnboardingState({
      email,
      emailVerified: true,
      fullName: fields.fullName.trim(),
      gender: fields.gender || undefined,
      dob: fields.dob,
      occupation: fields.occupation || undefined,
      addressLine1: fields.addressLine1.trim(),
      addressLine2: fields.addressLine2.trim() || undefined,
      currentCity: fields.currentCity.trim(),
      pincode: fields.pincode,
      monthlyIncome: fields.monthlyIncome || undefined,
      annualTurnover: fields.annualTurnover || undefined,
      annualProfit: fields.annualProfit || undefined,
      incomeAmount: fields.monthlyIncome || fields.annualTurnover || undefined,
      creditConsentAccepted: fields.creditConsentAccepted,
    });

    setSubmitError('');
    setIsNavigating(true);

    try {
      const result = await saveLeadDetails({
        ...(currentLeadUuid ? { leadUuid: currentLeadUuid } : {}),
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

      if (result.leadUuid) updateCustomerOnboardingState({ leadUuid: result.leadUuid });

      startTransition(() => router.push('/account'));
    } catch (err) {
      setIsNavigating(false);
      setSubmitError(err instanceof Error ? err.message : 'Unable to save your details right now. Please try again.');
    }
  }

  return (
    <>
      <section className="mc-card mc-card-glow" aria-labelledby="details-heading">
        <div className="mc-chip">Step 4 of 4</div>
        <h1
          id="details-heading"
          className="mt-3.5 mb-3 text-brand-navy text-[clamp(2.2rem,6vw,3.2rem)] leading-[0.96] tracking-[-0.05em]"
        >
          Customer details.
        </h1>
        <p className="text-brand-muted leading-[1.6]">
          We need a few more details to process your loan application. All information is encrypted and stored
          securely.
        </p>

        {noticeMessage && (
          <div className="mt-4">
            <AlertBanner variant="success">{noticeMessage}</AlertBanner>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 mt-5.5" noValidate>
          {activeSection === 'profile' ? (
            <div className={SECTION_CLASS}>
              <div className="grid gap-1">
                <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-brand-blue">Part 1 of 2</span>
                <h2 className="text-[1.25rem] font-extrabold tracking-[-0.03em] text-brand-navy">Personal profile</h2>
                <p className="text-[0.92rem] leading-[1.6] text-brand-muted">
                  Enter the identity details exactly as they appear on your KYC documents.
                </p>
              </div>

              <div className="grid gap-4">
                <FieldGroup label="Full name" htmlFor="fullName" error={errors.fullName} help="As per your official KYC documents.">
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
                    aria-describedby={errors.fullName ? 'fullName-error' : 'fullName-help'}
                    className={inputClass(Boolean(errors.fullName))}
                  />
                </FieldGroup>

                <FieldGroup label="Gender" htmlFor="gender" error={errors.gender} help="Select the gender shown on your documents.">
                  <select
                    id="gender"
                    name="gender"
                    value={fields.gender}
                    onChange={setField('gender')}
                    disabled={isLoadingLookups}
                    aria-invalid={Boolean(errors.gender)}
                    aria-describedby={errors.gender ? 'gender-error' : 'gender-help'}
                    className={inputClass(Boolean(errors.gender))}
                  >
                    <option value="">{isLoadingLookups ? 'Loading gender...' : 'Select gender'}</option>
                    {genderOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FieldGroup>

                <FieldGroup
                  label="Date of birth"
                  htmlFor="dob"
                  error={errors.dob}
                  help={
                    parseDobDisplay(dobDisplay)
                      ? `Selected: ${formatDateDisplay(parseDobDisplay(dobDisplay)!)}. You must be at least 18 years old.`
                      : 'You must be at least 18 years old. Type DD/MM/YYYY or use the calendar.'
                  }
                >
                  <DatePickerField
                    label="Date of birth"
                    value={dobDisplay}
                    onChange={handleDobChange}
                    maxDate={maxDob}
                    hint=" "
                  />
                </FieldGroup>

                <FieldGroup label="Occupation" htmlFor="occupation" error={errors.occupation} help="Choose the occupation that best describes you.">
                  <select
                    id="occupation"
                    name="occupation"
                    value={fields.occupation}
                    onChange={setField('occupation')}
                    disabled={isLoadingLookups}
                    aria-invalid={Boolean(errors.occupation)}
                    aria-describedby={errors.occupation ? 'occupation-error' : 'occupation-help'}
                    className={inputClass(Boolean(errors.occupation))}
                  >
                    <option value="">{isLoadingLookups ? 'Loading occupations...' : 'Select occupation'}</option>
                    {occupationOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </FieldGroup>
              </div>

              <div className="flex flex-wrap gap-[10px] mt-1 max-sm:flex-col max-sm:items-stretch">
                <button type="button" onClick={onBack} className="mc-btn-secondary text-brand-navy bg-[rgba(20,150,243,0.08)] text-center">
                  ← Back
                </button>
                <button type="button" onClick={handleContinueToFinancial} className="mc-btn-primary flex-1">
                  Continue to address and income
                </button>
              </div>
            </div>
          ) : (
            <div className={SECTION_CLASS}>
              <div className="grid gap-1">
                <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-brand-blue">Part 2 of 2</span>
                <h2 className="text-[1.25rem] font-extrabold tracking-[-0.03em] text-brand-navy">Address and income</h2>
                <p className="text-[0.92rem] leading-[1.6] text-brand-muted">
                  Add your city and income details, then accept consent to complete the application.
                </p>
              </div>

              <div className="grid gap-4">
                <FieldGroup label="Address line 1" htmlFor="addressLine1" error={errors.addressLine1} help="House number, building, street, or locality.">
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
                    aria-describedby={errors.addressLine1 ? 'addressLine1-error' : 'addressLine1-help'}
                    className={inputClass(Boolean(errors.addressLine1))}
                  />
                </FieldGroup>

                <FieldGroup label="Address line 2" htmlFor="addressLine2" error={errors.addressLine2} help="Landmark, area, or apartment name. Optional.">
                  <input
                    id="addressLine2"
                    name="addressLine2"
                    type="text"
                    autoComplete="address-line2"
                    placeholder="Landmark / Area / Apartment name"
                    value={fields.addressLine2}
                    onChange={setField('addressLine2')}
                    aria-invalid={Boolean(errors.addressLine2)}
                    aria-describedby={errors.addressLine2 ? 'addressLine2-error' : 'addressLine2-help'}
                    className={inputClass(Boolean(errors.addressLine2))}
                  />
                </FieldGroup>

                <FieldGroup label="City" htmlFor="currentCity" error={errors.currentCity} help="Search and select your current city.">
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
                    ariaDescribedBy={errors.currentCity ? 'currentCity-error' : 'currentCity-help'}
                  />
                </FieldGroup>

                <FieldGroup label="Pincode" htmlFor="pincode" error={errors.pincode} help="Your current residential pincode.">
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
                    aria-describedby={errors.pincode ? 'pincode-error' : 'pincode-help'}
                    className={inputClass(Boolean(errors.pincode))}
                  />
                </FieldGroup>

                {usesMonthlyIncome && (
                  <FieldGroup label="Monthly income" htmlFor="monthlyIncome" error={errors.monthlyIncome} help="Share your current take-home monthly income in INR.">
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
                      aria-describedby={errors.monthlyIncome ? 'monthlyIncome-error' : 'monthlyIncome-help'}
                      className={inputClass(Boolean(errors.monthlyIncome))}
                    />
                  </FieldGroup>
                )}

                {isSelfEmployed && (
                  <div className="grid gap-4">
                    <FieldGroup label="Annual turnover" htmlFor="annualTurnover" error={errors.annualTurnover} help="Share your latest annual turnover in INR.">
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
                        aria-describedby={errors.annualTurnover ? 'annualTurnover-error' : 'annualTurnover-help'}
                        className={inputClass(Boolean(errors.annualTurnover))}
                      />
                    </FieldGroup>

                    <FieldGroup label="Annual profit" htmlFor="annualProfit" error={errors.annualProfit} help="Share your latest annual profit in INR.">
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
                        aria-describedby={errors.annualProfit ? 'annualProfit-error' : 'annualProfit-help'}
                        className={inputClass(Boolean(errors.annualProfit))}
                      />
                    </FieldGroup>
                  </div>
                )}
              </div>

              <div className="grid gap-3 rounded-[22px] border border-[rgba(18,36,79,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,249,255,0.94))] px-4 py-4 shadow-[0_14px_28px_rgba(23,44,113,0.08)]">
                <label className="flex items-start gap-3">
                  <input
                    id="creditConsentAccepted"
                    name="creditConsentAccepted"
                    type="checkbox"
                    checked={fields.creditConsentAccepted}
                    onChange={setConsent}
                    className="mt-1 h-4 w-4 rounded border border-[rgba(18,36,79,0.24)] accent-brand-blue"
                  />
                  <span className="text-[0.94rem] leading-[1.65] text-brand-navy">{CUSTOMER_CREDIT_CONSENT_TEXT}</span>
                </label>
                <p
                  id={errors.creditConsentAccepted ? 'creditConsentAccepted-error' : 'creditConsentAccepted-help'}
                  className={`text-[0.875rem] leading-[1.55] ${errors.creditConsentAccepted ? 'text-[#b2372d]' : 'text-brand-muted'}`}
                >
                  {errors.creditConsentAccepted ?? 'This consent is required so lending partners can complete credit checks.'}
                </p>
                <CreditBureauPoweredBy />
              </div>

              {submitError && <AlertBanner variant="error">{submitError}</AlertBanner>}

              <div className="flex flex-wrap gap-[10px] mt-1 max-sm:flex-col max-sm:items-stretch">
                <button
                  type="button"
                  onClick={() => onSectionChange('profile')}
                  className="mc-btn-secondary text-brand-navy bg-[rgba(20,150,243,0.08)] text-center"
                >
                  ← Back to personal profile
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

/* ── Local sub-components ──────────────────��─────────────────────────────── */

function inputClass(hasError: boolean): string {
  return cn(
    'w-full min-h-[52px] px-4 rounded-[16px] border bg-white',
    'text-brand-navy text-[1rem] font-bold outline-0',
    'shadow-[0_10px_18px_rgba(23,44,113,0.04)] transition-all duration-[220ms]',
    'focus:-translate-y-0.5 focus:scale-[1.005]',
    'focus:border-[rgba(20,150,243,0.46)]',
    'focus:shadow-[0_22px_42px_rgba(23,44,113,0.12),0_0_0_6px_rgba(20,150,243,0.08)]',
    hasError
      ? 'border-[rgba(193,57,43,0.42)] shadow-[0_0_0_3px_rgba(193,57,43,0.08)]'
      : 'border-[rgba(18,36,79,0.16)]',
  );
}

type FieldGroupProps = {
  label: string;
  htmlFor: string;
  error?: string;
  help: string;
  children: ReactNode;
};

function FieldGroup({ label, htmlFor, error, help, children }: FieldGroupProps) {
  return (
    <div className="grid gap-[8px]">
      <label htmlFor={htmlFor} className="text-[0.92rem] font-extrabold text-brand-navy">
        {label}
      </label>
      {children}
      <p
        id={error ? `${htmlFor}-error` : `${htmlFor}-help`}
        className={`text-[0.875rem] leading-[1.55] ${error ? 'text-[#b2372d]' : 'text-brand-muted'}`}
      >
        {error ?? help}
      </p>
    </div>
  );
}

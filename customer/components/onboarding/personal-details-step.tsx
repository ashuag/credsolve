'use client';

import {type ChangeEvent, type ReactNode, type SubmitEvent, useEffect, useRef, useState,} from 'react';
import {useRouter} from 'next/navigation';
import {SessionRequiredAlert} from '@/components/auth/session-required-alert';
import {AlertBanner} from '@/components/ui/alert-banner';
import {DatePickerField} from '@/components/ui/date-picker-field';
import {FlowLoader} from '@/components/ui/flow-loader';
import {SearchableCityInput} from '@/components/ui/searchable-city-input';
import type {CustomerPortalProfile} from '@/lib/api/customer-session';
import {saveLeadDetails, saveLeadProfile, verifyLeadPan} from '@/lib/api/lead';
import {fetchPincodeLookup} from '@/lib/api/lookup';
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
import {isValidPan, isValidPersonName, PERSON_NAME_VALIDATION_MESSAGE, PINCODE_REGEX, sanitizePersonNameInput} from '@/lib/validators';
import {useJourneyProgressOptional} from '@/components/journey/journey-progress-context';

const SECTION_CLASS =
  'grid gap-3 rounded-[24px] border border-[rgba(18,36,79,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,249,255,0.94))] p-4 shadow-[0_14px_28px_rgba(23,44,113,0.08)] sm:p-5';
const DETAILS_DRAFT_KEY_PREFIX = 'mc:details:draft:';

type Fields = {
  fullName: string;
  gender: CustomerGenderValue | '';
  dob: string; // YYYY-MM-DD ISO, derived from dobDisplay
  panNumber: string;
  occupation: CustomerOccupationValue | '';
  addressLine1: string;
  addressLine2: string;
  currentCity: string;
  /** Populated when the user picks a row from `/lookup/cities` (preferred for save). */
  currentCityId: number | null;
  pincode: string;
  monthlyIncome: string;
  annualTurnover: string;
  annualProfit: string;
  creditConsentAccepted: boolean;
};

function computeProfileCompletionRatio(fields: Fields, dobDisplay: string): number {
  const checks: boolean[] = [];
  checks.push(isValidPersonName(fields.fullName));
  checks.push(Boolean(fields.gender));
  checks.push(Boolean(dobDisplay.trim() && fields.dob));
  checks.push(isValidPan(fields.panNumber.trim()));
  checks.push(Boolean(fields.occupation));
  const occ = fields.occupation;
  if (occ && usesMonthlyIncomeMetric(occ)) {
    const m = fields.monthlyIncome.trim();
    checks.push(m !== '' && Number.isFinite(Number(m)) && Number(m) >= 0);
  }
  if (occ && usesAnnualFinancialMetric(occ)) {
    checks.push(Boolean(fields.annualTurnover && Number(fields.annualTurnover) > 0));
    checks.push(Boolean(fields.annualProfit && Number(fields.annualProfit) > 0));
  }
  return checks.length === 0 ? 0 : checks.filter(Boolean).length / checks.length;
}

function computeFinancialCompletionRatio(fields: Fields): number {
  const core = [
    PINCODE_REGEX.test(fields.pincode),
    Boolean(fields.currentCity.trim()),
    fields.addressLine1.trim().length >= 5,
    fields.creditConsentAccepted,
  ];
  let score = core.filter(Boolean).length / core.length;
  if (fields.addressLine2.trim()) {
    score = Math.min(1, score + 0.05);
  }
  return score;
}

type FieldError = Partial<Record<keyof Fields, string>>;
export type PersonalDetailsSection = 'profile' | 'financial';

/** Fields collected on part 1 (profile + income after occupation). */
const PROFILE_PAGE_FIELDS: Array<keyof Fields> = [
  'fullName',
  'gender',
  'dob',
  'panNumber',
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
    panNumber: '',
    occupation: '',
    addressLine1: '',
    addressLine2: '',
    currentCity: '',
    currentCityId: null,
    pincode: '',
    monthlyIncome: '',
    annualTurnover: '',
    annualProfit: '',
    creditConsentAccepted: false,
  });
  // Display value DD/MM/YYYY; fields.dob holds YYYY-MM-DD
  const [dobDisplay, setDobDisplay] = useState('');
  const [errors, setErrors] = useState<FieldError>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isLookingUpPincode, setIsLookingUpPincode] = useState(false);
  const [cityFromPincode, setCityFromPincode] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { cityOptions, genderOptions, occupationOptions, isLoading: isLoadingLookups } = useCustomerDetailLookups();

  // Build the max-selectable date: must be 18+ years old
  const maxDob = new Date();
  maxDob.setFullYear(maxDob.getFullYear() - 18);

  const isSelfEmployed = usesAnnualFinancialMetric(fields.occupation || undefined);
  const usesMonthlyIncome = usesMonthlyIncomeMetric(fields.occupation || undefined);
  const draftStorageKey = `${DETAILS_DRAFT_KEY_PREFIX}${leadUuid}`;
  const setCompletion01 = useJourneyProgressOptional()?.setCompletion01;
  const lastResolvedPincodeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!setCompletion01) return;
    if (activeSection === 'profile') {
      const r = computeProfileCompletionRatio(fields, dobDisplay);
      setCompletion01(0.15 + r * 0.36);
    } else {
      const r = computeFinancialCompletionRatio(fields);
      setCompletion01(0.52 + r * 0.47);
    }
  }, [fields, dobDisplay, activeSection, setCompletion01]);

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
      panNumber: p.panNumber ?? prev.panNumber,
      occupation: (p.occupation as Fields['occupation']) || prev.occupation,
      addressLine1: p.addressLine1 ?? prev.addressLine1,
      addressLine2: p.addressLine2 ?? prev.addressLine2,
      currentCity: p.currentCity ?? prev.currentCity,
      currentCityId: null,
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

  useEffect(() => {
    if (!PINCODE_REGEX.test(fields.pincode)) {
      if (lastResolvedPincodeRef.current) {
        lastResolvedPincodeRef.current = null;
        setCityFromPincode(false);
        setFields((prev) => ({ ...prev, currentCity: '', currentCityId: null }));
      }
      return;
    }

    if (lastResolvedPincodeRef.current === fields.pincode) {
      return;
    }

    let isActive = true;

    async function resolvePincode() {
      setIsLookingUpPincode(true);
      try {
        const result = await fetchPincodeLookup(fields.pincode);
        if (!isActive) return;

        if (result) {
          lastResolvedPincodeRef.current = fields.pincode;
          setFields((prev) => ({
            ...prev,
            currentCity: result.cityName,
            currentCityId: result.cityId,
          }));
          setCityFromPincode(true);
          setErrors((prev) => ({ ...prev, pincode: undefined, currentCity: undefined }));
        } else {
          lastResolvedPincodeRef.current = null;
          setCityFromPincode(false);
          setErrors((prev) => ({
            ...prev,
            pincode: 'We could not find this pincode. Please enter a valid 6-digit pincode.',
          }));
        }
      } catch {
        if (!isActive) return;
        lastResolvedPincodeRef.current = null;
        setCityFromPincode(false);
      } finally {
        if (isActive) {
          setIsLookingUpPincode(false);
        }
      }
    }

    void resolvePincode();

    return () => {
      isActive = false;
    };
  }, [fields.pincode]);

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
      if (key === 'fullName') {
        value = sanitizePersonNameInput(value);
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

  function validateProfileFields(): FieldError {
    const today = new Date();
    const next: FieldError = {};

    if (!isValidPersonName(fields.fullName)) {
      next.fullName =
        fields.fullName.trim().length === 0
          ? 'Please enter your full name as per your PAN card.'
          : PERSON_NAME_VALIDATION_MESSAGE;
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
    if (!isValidPan(fields.panNumber.trim())) {
      next.panNumber = 'Please enter a valid 10-character PAN.';
    }
    if (!fields.occupation) next.occupation = 'Please select your occupation.';
    if (usesMonthlyIncome) {
      const raw = fields.monthlyIncome.trim();
      if (!raw || !Number.isFinite(Number(raw)) || Number(raw) < 0) {
        next.monthlyIncome = 'Please enter your monthly income (0 is allowed).';
      }
    }
    if (isSelfEmployed) {
      if (!fields.annualTurnover || Number(fields.annualTurnover) <= 0) next.annualTurnover = 'Please enter your annual turnover.';
      if (!fields.annualProfit || Number(fields.annualProfit) <= 0) next.annualProfit = 'Please enter your annual profit.';
    }

    return next;
  }

  function validateFinancialFields(): FieldError {
    const next: FieldError = {};

    if (!PINCODE_REGEX.test(fields.pincode)) next.pincode = 'Please enter a valid 6-digit pincode.';
    if (!fields.currentCity.trim()) next.currentCity = 'Please enter your current city.';
    if (!fields.addressLine1.trim() || fields.addressLine1.trim().length < 5) {
      next.addressLine1 = 'Please enter your address line 1.';
    }
    if (!fields.creditConsentAccepted) next.creditConsentAccepted = 'Please accept the consent declaration to continue.';

    return next;
  }

  function validate(): FieldError {
    return { ...validateProfileFields(), ...validateFinancialFields() };
  }

  async function handleContinueToFinancial() {
    if (isSavingProfile) return;

    const validation = validateProfileFields();
    const sectionErrors = pickErrors(validation, PROFILE_PAGE_FIELDS);
    if (Object.keys(sectionErrors).length > 0) {
      setErrors(sectionErrors);
      return;
    }
    setErrors((prev) => ({
      ...prev,
      fullName: undefined,
      gender: undefined,
      dob: undefined,
      panNumber: undefined,
      occupation: undefined,
      monthlyIncome: undefined,
      annualTurnover: undefined,
      annualProfit: undefined,
    }));
    setSubmitError('');
    setIsSavingProfile(true);

    try {
      await saveLeadProfile({
        leadUuid,
        fullName: fields.fullName.trim(),
        dob: fields.dob,
        gender: fields.gender as CustomerGenderValue,
        occupation: fields.occupation as CustomerOccupationValue,
        panNumber: fields.panNumber.trim().toUpperCase(),
        ...(usesMonthlyIncome ? { monthlyIncome: fields.monthlyIncome.trim() } : {}),
        ...(isSelfEmployed
          ? { annualTurnover: fields.annualTurnover.trim(), annualProfit: fields.annualProfit.trim() }
          : {}),
      });
      onSectionChange('financial');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to save your profile right now. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
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
    setIsSubmittingProfile(true);

    try {
      await saveLeadDetails({
        leadUuid,
        fullName: fields.fullName.trim(),
        dob: fields.dob,
        gender: fields.gender as CustomerGenderValue,
        occupation: fields.occupation as CustomerOccupationValue,
        panNumber: fields.panNumber.trim().toUpperCase(),
        addressLine1: fields.addressLine1.trim(),
        ...(fields.addressLine2.trim() ? { addressLine2: fields.addressLine2.trim() } : {}),
        currentCity: fields.currentCity.trim(),
        ...(fields.currentCityId != null ? { currentCityId: fields.currentCityId } : {}),
        pincode: fields.pincode,
        creditConsentAccepted: fields.creditConsentAccepted,
        ...(usesMonthlyIncome ? { monthlyIncome: fields.monthlyIncome.trim() } : {}),
        ...(isSelfEmployed
          ? { annualTurnover: fields.annualTurnover.trim(), annualProfit: fields.annualProfit.trim() }
          : {}),
      });

      const result = await verifyLeadPan({
        ...(leadUuid ? { leadUuid } : {}),
        panNumber: fields.panNumber.trim().toUpperCase(),
        fullName: fields.fullName.trim(),
        dob: fields.dob,
        gender: fields.gender as CustomerGenderValue,
        occupation: fields.occupation as CustomerOccupationValue,
        creditConsentAccepted: fields.creditConsentAccepted,
        ...(usesMonthlyIncome ? { monthlyIncome: fields.monthlyIncome.trim() } : {}),
        ...(isSelfEmployed
          ? { annualTurnover: fields.annualTurnover.trim(), annualProfit: fields.annualProfit.trim() }
          : {}),
      });

      if (!result.success) {
        setSubmitError('Unable to complete your profile right now. Please try again.');
        return;
      }
      if (result.rejected || result.panVerifiedStatus === 2) {
        router.push('/thank-you-interest');
        return;
      }

      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // Ignore storage cleanup failures.
      }

      await onSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to complete your profile right now. Please try again.');
    } finally {
      setIsSubmittingProfile(false);
    }
  }

  return (
    <>
      <section className="h-full flex flex-col" aria-labelledby="details-heading">
        <div className="mb-4">
          <h2
            id="details-heading"
            className="text-xl md:text-[1.8rem] font-extrabold text-brand-navy mb-3 tracking-tight leading-[1.1]"
          >
            Complete Your <span className="text-brand-blue">Profile</span> ✨
          </h2>

          <div className="flex items-start gap-3 p-3 mb-0 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100/60">
            <div className="p-1.5 bg-white rounded-xl shadow-sm text-blue-600 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-[0.88rem] text-slate-600 leading-relaxed m-0 pt-0.5">
              {activeSection === 'profile'
                ? 'Please provide your personal and financial details to complete your loan profile.'
                : 'Enter your residential pincode and address to finish your application.'}
            </p>
          </div>
        </div>

        {noticeMessage && (
          <div className="mb-4">
            <AlertBanner variant="success">{noticeMessage}</AlertBanner>
          </div>
        )}
        {submitError && activeSection === 'profile' && (
          <div className="mb-4">
            <SessionRequiredAlert message={submitError} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 mt-2" noValidate>
          {activeSection === 'profile' ? (
            <div className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                <div className="md:col-span-2">
                  <FieldGroup labelSentenceCase label="Full name as per PAN card" htmlFor="fullName" error={errors.fullName}>
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
                  <FieldGroup label="PAN" htmlFor="panNumber" error={errors.panNumber}>
                    <input
                      id="panNumber"
                      name="panNumber"
                      type="text"
                      autoComplete="off"
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      required
                      value={fields.panNumber}
                      onChange={(event) => {
                        const v = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                        setFields((prev) => ({ ...prev, panNumber: v }));
                        if (submitError) setSubmitError('');
                        if (errors.panNumber) setErrors((prev) => ({ ...prev, panNumber: undefined }));
                      }}
                      aria-invalid={Boolean(errors.panNumber)}
                      aria-describedby={errors.panNumber ? 'panNumber-error' : undefined}
                      className={inputClass(Boolean(errors.panNumber))}
                    />
                  </FieldGroup>
                </div>

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

              {/* Sticky CTA row — pins to bottom of scroll container on mobile */}
              <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-sm mt-6 flex flex-col sm:flex-row gap-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-slate-100 -mx-5 px-5 lg:mx-0 lg:px-0">
                <button type="button" onClick={onBack} className="py-3 px-4 rounded-xl font-bold text-[0.95rem] text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors text-center border border-slate-200">
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleContinueToFinancial()}
                  disabled={isSavingProfile}
                  aria-busy={isSavingProfile}
                  className="mc-btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="inline-flex items-center justify-center gap-[10px]">
                    {isSavingProfile ? (
                      <span
                        className="w-[18px] h-[18px] shrink-0 rounded-full border-2 border-[rgba(255,248,223,0.28)] border-t-[#fff8df] animate-spin-btn"
                        aria-hidden
                      />
                    ) : null}
                    <span>{isSavingProfile ? 'Saving…' : 'Continue'}</span>
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                <div className="md:col-span-2">
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
                    {isLookingUpPincode && (
                      <p className="text-[0.75rem] text-slate-500 pl-1 mt-1">Looking up city for this pincode…</p>
                    )}
                  </FieldGroup>
                </div>

                <div className="md:col-span-2">
                  <FieldGroup label="City" htmlFor="currentCity" error={errors.currentCity}>
                    <SearchableCityInput
                      id="currentCity"
                      name="currentCity"
                      value={fields.currentCity}
                      options={cityOptions}
                      onChange={(next) => {
                        setCityFromPincode(false);
                        lastResolvedPincodeRef.current = null;
                        setFields((prev) => ({
                          ...prev,
                          currentCity: next.label,
                          currentCityId: next.cityId,
                        }));
                        if (errors.currentCity) setErrors((prev) => ({ ...prev, currentCity: undefined }));
                      }}
                      className={inputClass(Boolean(errors.currentCity))}
                      placeholder={cityFromPincode ? 'Auto-filled from pincode' : 'Start typing your city'}
                      isLoading={isLoadingLookups}
                      disabled={cityFromPincode || isLookingUpPincode}
                      ariaInvalid={Boolean(errors.currentCity)}
                      ariaDescribedBy={errors.currentCity ? 'currentCity-error' : undefined}
                    />
                  </FieldGroup>
                </div>

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
              </div>

              <div className="mt-4 md:mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 md:col-span-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="creditConsentAccepted"
                    name="creditConsentAccepted"
                    type="checkbox"
                    checked={fields.creditConsentAccepted}
                    onChange={setConsent}
                    className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[0.85rem] leading-relaxed text-slate-600">{CUSTOMER_CREDIT_CONSENT_TEXT}</span>
                </label>
                {errors.creditConsentAccepted && (
                  <p id="creditConsentAccepted-error" className="mt-2 text-[#b2372d] text-sm font-medium">
                    {errors.creditConsentAccepted}
                  </p>
                )}
              </div>

              {submitError && <SessionRequiredAlert message={submitError} />}

              {/* Sticky CTA row */}
              <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-sm mt-6 flex flex-col sm:flex-row gap-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-slate-100 -mx-5 px-5 lg:mx-0 lg:px-0">
                <button
                  type="button"
                  onClick={() => onSectionChange('profile')}
                  className="py-3 px-4 rounded-xl font-bold text-[0.95rem] text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors text-center border border-slate-200"
                >
                  ← Back
                </button>
                <button type="submit" className="mc-btn-primary flex-1" disabled={isSubmittingProfile}>
                  {isSubmittingProfile ? 'Submitting...' : 'Complete application'}
                </button>
              </div>
            </div>
          )}
        </form>
      </section>

      {isSubmittingProfile && (
        <FlowLoader
          eyebrow="Almost there"
          title="Checking your eligibility"
          description="We save your address, run pre-checks, verify PAN, fetch CIBIL when needed, then calculate your eligible loan amount."
          steps={[
            'Saving your address',
            'Pre-eligibility checks',
            'PAN verification and bureau',
          ]}
        />
      )}
    </>
  );
}

/* ── Local sub-components ─────────────────────────────────────────────────── */

function inputClass(hasError: boolean): string {
  return cn(
    'mc-autofill-fix w-full h-[48px] rounded-xl border px-3',
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
  /** Long labels read better without `uppercase` (e.g. legal wording). */
  labelSentenceCase?: boolean;
};

function FieldGroup({ label, htmlFor, error, children, labelSentenceCase }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label
        htmlFor={htmlFor}
        className={
          labelSentenceCase
            ? 'text-[0.75rem] font-bold text-slate-600 tracking-normal pl-1 leading-snug'
            : 'text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider pl-1'
        }
      >
        {label}
      </label>
      {children}
      {error && <p id={`${htmlFor}-error`} className="text-[#b2372d] text-[0.75rem] pl-1 font-medium m-0">{error}</p>}
    </div>
  );
}

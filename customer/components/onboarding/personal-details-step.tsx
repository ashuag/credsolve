'use client';

import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { SessionRequiredAlert } from '@/components/auth/session-required-alert';
import { AlertBanner } from '@/components/ui/alert-banner';
import { FlowLoader } from '@/components/ui/flow-loader';
import type { CityInputChange } from '@/components/ui/searchable-city-input';
import type { CustomerPortalProfile } from '@/lib/api/customer-session';
import { saveLeadDetails, saveLeadProfile, verifyLeadPan } from '@/lib/api/lead';
import { fetchPincodeLookup } from '@/lib/api/lookup';
import { usesAnnualFinancialMetric, usesMonthlyIncomeMetric } from '@/lib/customer-details';
import { formatDateDisplay, formatDateIso, getAge, parseDobDisplay, parseIsoDate } from '@/lib/date-utils';
import { useCustomerDetailLookups } from '@/lib/use-customer-detail-lookups';
import { isValidPan, isValidPersonName, PERSON_NAME_VALIDATION_MESSAGE, PINCODE_REGEX, sanitizePersonNameInput } from '@/lib/validators';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';
import { ProfileFields } from './profile-fields';
import { FinancialFields } from './financial-fields';
import type { Fields, FieldError } from './_types';

export type PersonalDetailsSection = 'profile' | 'financial';
type BusyState = 'idle' | 'saving' | 'submitting' | 'rejecting';

export type PersonalDetailsStepProps = {
  email: string;
  leadUuid: string;
  initialProfile: CustomerPortalProfile | null;
  onSaved: () => void | Promise<void>;
  activeSection: PersonalDetailsSection;
  onSectionChange: (section: PersonalDetailsSection) => void;
  onBack: () => void;
  noticeMessage?: string | null;
};

const DRAFT_KEY_PREFIX = 'mc:details:draft:';
const PROFILE_FIELDS: Array<keyof Fields> = ['fullName', 'gender', 'dob', 'panNumber', 'occupation', 'monthlyIncome', 'annualTurnover', 'annualProfit'];

function pickErrors(errors: FieldError, keys: Array<keyof Fields>): FieldError {
  return Object.fromEntries(keys.filter((k) => errors[k]).map((k) => [k, errors[k]]));
}
function hasErrors(errors: FieldError, keys: Array<keyof Fields>): boolean {
  return keys.some((k) => Boolean(errors[k]));
}

function profileCompletion(fields: Fields, dobDisplay: string): number {
  const checks = [
    isValidPersonName(fields.fullName),
    Boolean(fields.gender),
    Boolean(dobDisplay.trim() && fields.dob),
    isValidPan(fields.panNumber.trim()),
    Boolean(fields.occupation)
  ];

  const occ = fields.occupation;
  if (occ && usesMonthlyIncomeMetric(occ)) {
    const m = fields.monthlyIncome.trim();
    checks.push(m !== '' && Number.isFinite(Number(m)) && Number(m) >= 0);
  }

  if (occ && usesAnnualFinancialMetric(occ)) {
    checks.push(Boolean(fields.annualTurnover && Number(fields.annualTurnover) > 0));
    checks.push(Boolean(fields.annualProfit && Number(fields.annualProfit) > 0));
  }

  return checks.filter((v) => Boolean(v)).length / checks.length;
}

function financialCompletion(fields: Fields): number {
  const s = [
    PINCODE_REGEX.test(fields.pincode),
    Boolean(fields.currentCity.trim()),
    fields.addressLine1.trim().length >= 5,
    fields.creditConsentAccepted
  ].filter((v) => Boolean(v)).length / 4;

  return fields.addressLine2.trim() ? Math.min(1, s + 0.05) : s;
}

const EMPTY_FIELDS: Fields = {
  fullName: '',
  gender: '', dob: '',
  panNumber: '',
  occupation: '',
  addressLine1: '', addressLine2: '', currentCity: '', currentCityId: null,
  pincode: '', monthlyIncome: '', annualTurnover: '', annualProfit: '', creditConsentAccepted: false,
};

export function PersonalDetailsStep(
  {
    leadUuid,
    initialProfile,
    onSaved,
    activeSection,
    onSectionChange, onBack,
    noticeMessage
  }: PersonalDetailsStepProps) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [dobDisplay, setDobDisplay] = useState('');
  const [errors, setErrors] = useState<FieldError>({});
  const [busy, setBusy] = useState<BusyState>('idle');
  const [isLookingUpPincode, setIsLookingUpPincode] = useState(false);
  const [cityFromPincode, setCityFromPincode] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { genderOptions, occupationOptions, isLoading: isLoadingLookups } = useCustomerDetailLookups();

  const setCompletion01 = useJourneyProgressOptional()?.setCompletion01;
  const lastPincodeRef = useRef<string | null>(null);
  const draftKey = `${DRAFT_KEY_PREFIX}${leadUuid}`;

  const maxDob = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d; }, []);
  const isSelfEmployed = usesAnnualFinancialMetric(fields.occupation || undefined);
  const usesMonthlyIncome = usesMonthlyIncomeMetric(fields.occupation || undefined);

  useEffect(() => {
    if (!setCompletion01) return;
    const r = activeSection === 'profile' ? profileCompletion(fields, dobDisplay) : financialCompletion(fields);
    setCompletion01(activeSection === 'profile' ? 0.15 + r * 0.36 : 0.52 + r * 0.47);
  }, [fields, dobDisplay, activeSection, setCompletion01]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(draftKey) ?? 'null') as { fields?: Fields; dobDisplay?: string } | null;
      if (parsed?.fields) setFields((p) => ({ ...p, ...parsed.fields }));
      if (typeof parsed?.dobDisplay === 'string') setDobDisplay(parsed.dobDisplay);
    } catch { /* ignore */ }
  }, [draftKey]);

  useEffect(() => {
    if (!initialProfile) return;
    const p = initialProfile;
    setFields((prev) => ({
      fullName: p.fullName ?? prev.fullName, gender: (p.gender as Fields['gender']) || prev.gender,
      dob: p.dob ?? prev.dob, panNumber: p.panNumber ?? prev.panNumber,
      occupation: (p.occupation as Fields['occupation']) || prev.occupation,
      addressLine1: p.addressLine1 ?? prev.addressLine1, addressLine2: p.addressLine2 ?? prev.addressLine2,
      currentCity: p.currentCity ?? prev.currentCity, currentCityId: null,
      pincode: p.pincode ?? prev.pincode, monthlyIncome: p.monthlyIncome ?? prev.monthlyIncome,
      annualTurnover: p.annualTurnover ?? prev.annualTurnover, annualProfit: p.annualProfit ?? prev.annualProfit,
      creditConsentAccepted: p.creditConsentAccepted ?? prev.creditConsentAccepted,
    }));
    const d = p.dob ? parseIsoDate(p.dob) : null;
    if (d) setDobDisplay(formatDateDisplay(d));
  }, [initialProfile]);

  useEffect(() => {
    try { window.localStorage.setItem(draftKey, JSON.stringify({ fields, dobDisplay })); } catch { /* ignore */ }
  }, [draftKey, fields, dobDisplay]);

  useEffect(() => {
    if (!PINCODE_REGEX.test(fields.pincode)) {
      if (lastPincodeRef.current) { lastPincodeRef.current = null; setCityFromPincode(false); setFields((p) => ({ ...p, currentCity: '', currentCityId: null })); }
      return;
    }
    if (lastPincodeRef.current === fields.pincode) return;
    let active = true;
    setIsLookingUpPincode(true);
    fetchPincodeLookup(fields.pincode)
      .then((res) => {
        if (!active) return;
        if (res) { lastPincodeRef.current = fields.pincode; setFields((p) => ({ ...p, currentCity: res.cityName, currentCityId: res.cityId })); setCityFromPincode(true); setErrors((p) => ({ ...p, pincode: undefined, currentCity: undefined })); }
        else { lastPincodeRef.current = null; setCityFromPincode(false); setErrors((p) => ({ ...p, pincode: 'We could not find this pincode. Please enter a valid 6-digit pincode.' })); }
      })
      .catch(() => { if (active) { lastPincodeRef.current = null; setCityFromPincode(false); } })
      .finally(() => { if (active) setIsLookingUpPincode(false); });
    return () => { active = false; };
  }, [fields.pincode]);

  const handleDobChange = useCallback((v: string) => {
    setDobDisplay(v); const p = parseDobDisplay(v);
    setFields((f) => ({ ...f, dob: p ? formatDateIso(p) : '' }));
    setErrors((e) => ({ ...e, dob: undefined })); setSubmitError('');
  }, []);

  const setField = useCallback(
    (key: Exclude<keyof Fields, 'creditConsentAccepted'>) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      let v = e.target.value;
      if (['monthlyIncome', 'annualTurnover', 'annualProfit'].includes(key)) v = v.replace(/\D/g, '').slice(0, 12);
      else if (key === 'pincode') v = v.replace(/\D/g, '').slice(0, 6);
      else if (key === 'fullName') v = sanitizePersonNameInput(v);
      setFields((prev) => {
        const next = { ...prev, [key]: v } as Fields;
        if (key === 'occupation') {
          const occ = v;
          if (usesAnnualFinancialMetric(occ || undefined)) next.monthlyIncome = '';
          else if (usesMonthlyIncomeMetric(occ || undefined)) { next.annualTurnover = ''; next.annualProfit = ''; }
          else { next.monthlyIncome = ''; next.annualTurnover = ''; next.annualProfit = ''; }
        }
        return next;
      });
      setSubmitError('');
      setErrors((prev) => ({ ...prev, [key]: undefined, ...(key === 'occupation' ? { monthlyIncome: undefined, annualTurnover: undefined, annualProfit: undefined } : {}) }));
    }, []);

  const handlePanChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      setFields((f) => ({ ...f, panNumber: v })); 
      setSubmitError(''); 
      setErrors((e) => ({ ...e, panNumber: undefined })); 
    }, []);

  const handleCityChange = useCallback((next: CityInputChange) => {
    setCityFromPincode(false); lastPincodeRef.current = null;
    setFields((f) => ({ ...f, currentCity: next.label, currentCityId: next.cityId }));
    setErrors((e) => ({ ...e, currentCity: undefined }));
  }, []);

  const setConsent = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked; setFields((f) => ({ ...f, creditConsentAccepted: checked })); setSubmitError('');
    if (checked) setErrors((e) => ({ ...e, creditConsentAccepted: undefined }));
  }, []);

  function validateProfile(): FieldError {
    const today = new Date(); const err: FieldError = {};
    if (!isValidPersonName(fields.fullName)) err.fullName = fields.fullName.trim() ? PERSON_NAME_VALIDATION_MESSAGE : 'Please enter your full name as per your PAN card.';
    const dob = parseDobDisplay(dobDisplay);
    if (!dobDisplay.trim()) err.dob = 'Please enter your date of birth.';
    else if (!dob || dob > today || !Number.isFinite(getAge(fields.dob))) err.dob = 'Please enter a valid date of birth.';
    else if (getAge(fields.dob) < 18) err.dob = 'You must be at least 18 years old to apply.';
    if (!fields.gender) err.gender = 'Please select your gender.';
    if (!isValidPan(fields.panNumber.trim())) err.panNumber = 'Please enter a valid 10-character PAN.';
    if (!fields.occupation) err.occupation = 'Please select your occupation.';
    if (usesMonthlyIncome) { const m = fields.monthlyIncome.trim(); if (!m || !Number.isFinite(Number(m)) || Number(m) < 0) err.monthlyIncome = 'Please enter your monthly income (0 is allowed).'; }
    if (isSelfEmployed) {
      if (!fields.annualTurnover || Number(fields.annualTurnover) <= 0) err.annualTurnover = 'Please enter your annual turnover.';
      if (!fields.annualProfit || Number(fields.annualProfit) <= 0) err.annualProfit = 'Please enter your annual profit.';
    }
    return err;
  }

  function validateFinancial(): FieldError {
    const err: FieldError = {};
    if (!PINCODE_REGEX.test(fields.pincode)) err.pincode = 'Please enter a valid 6-digit pincode.';
    if (!fields.currentCity.trim()) err.currentCity = 'Please enter your current city.';
    if (!fields.addressLine1.trim() || fields.addressLine1.trim().length < 5) err.addressLine1 = 'Please enter your address line 1.';
    if (!fields.creditConsentAccepted) err.creditConsentAccepted = 'Please accept the consent declaration to continue.';
    return err;
  }

  function profilePayload() {
    const pan = fields.panNumber.trim().toUpperCase();
    return {
      leadUuid, 
      fullName: fields.fullName.trim(), 
      dob: fields.dob,
      gender: fields.gender,
      occupation: fields.occupation,
      panNumber: pan,
      ...(usesMonthlyIncome ? { monthlyIncome: fields.monthlyIncome.trim() } : {}),
      ...(isSelfEmployed ? { annualTurnover: fields.annualTurnover.trim(), 
      annualProfit: fields.annualProfit.trim() } : {}),
    };
  }

  async function handleContinue() {
    const profileErrors = pickErrors(validateProfile(), PROFILE_FIELDS);
    if (Object.keys(profileErrors).length) { 
      setErrors(profileErrors); 
      
      return; 
    }
    setErrors({}); 
    setSubmitError(''); 
    setBusy('saving');
    try {
      const profileResult = await saveLeadProfile(profilePayload());
      if (profileResult?.rejected) { router.push('/thank-you-interest'); return; }
      onSectionChange('financial');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unable to save your profile right now. Please try again.');
    }
    
    finally { setBusy('idle'); }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const all = { ...validateProfile(), ...validateFinancial() };
    if (Object.keys(all).length) { setErrors(all); onSectionChange(hasErrors(all, PROFILE_FIELDS) ? 'profile' : 'financial'); return; }
    setSubmitError(''); setBusy('submitting');
    try {
      await saveLeadDetails({
        ...profilePayload(), addressLine1: fields.addressLine1.trim(),
        ...(fields.addressLine2.trim() ? { addressLine2: fields.addressLine2.trim() } : {}),
        currentCity: fields.currentCity.trim(), ...(fields.currentCityId != null ? { currentCityId: fields.currentCityId } : {}),
        pincode: fields.pincode, creditConsentAccepted: fields.creditConsentAccepted,
      });
      const result = await verifyLeadPan({
        ...(leadUuid ? { leadUuid } : {}), panNumber: fields.panNumber.trim().toUpperCase(),
        fullName: fields.fullName.trim(), dob: fields.dob,
        gender: fields.gender, occupation: fields.occupation,
        creditConsentAccepted: fields.creditConsentAccepted,
        ...(usesMonthlyIncome ? { monthlyIncome: fields.monthlyIncome.trim() } : {}),
        ...(isSelfEmployed ? { annualTurnover: fields.annualTurnover.trim(), annualProfit: fields.annualProfit.trim() } : {}),
      });
      if (!result.success) { setSubmitError('Unable to complete your profile right now. Please try again.'); return; }
      if (result.rejected) { router.push('/thank-you-interest'); return; }
      if (result.attemptsUsed != null && result.attemptsAllowed != null) {
        const remaining = result.attemptsAllowed - result.attemptsUsed;
        setErrors((e) => ({ ...e, panNumber: `PAN verification failed. ${remaining > 0 ? `You have ${remaining} attempt(s) remaining.` : 'No attempts remaining.'}` }));
        onSectionChange('profile');
        return;
      }
      try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ }
      await onSaved();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unable to complete your profile right now. Please try again.');
    } finally { setBusy('idle'); }
  }

  const isBusy = busy !== 'idle';

  return (
    <>
      <section className="h-full flex flex-col" aria-labelledby="details-heading">
        <div className="mb-4">
          <h2 id="details-heading" className="text-xl md:text-[1.8rem] font-extrabold text-brand-navy mb-3 tracking-tight leading-[1.1]">
            Complete Your <span className="text-brand-blue">Profile</span> ✨
          </h2>
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-linear-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100/60">
            <div className="p-1.5 bg-white rounded-xl shadow-sm text-blue-600 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-[0.88rem] text-slate-600 leading-relaxed m-0 pt-0.5">
              {activeSection === 'profile' ? 'Please provide your personal and financial details to complete your loan profile.' : 'Enter your residential pincode and address to finish your application.'}
            </p>
          </div>
        </div>

        {noticeMessage && 
        <div className="mb-4">
          <AlertBanner variant="success">{noticeMessage}</AlertBanner>
          </div>
        }
        {submitError && activeSection === 'profile' && <div className="mb-4"><SessionRequiredAlert message={submitError} /></div>}

        <form onSubmit={handleSubmit} className="grid gap-4 mt-2" noValidate>
          {activeSection === 'profile' ? (
            <ProfileFields
              fields={fields} 
              errors={errors}
              genderOptions={genderOptions} 
              occupationOptions={occupationOptions}
              isLoadingLookups={isLoadingLookups} 
              maxDob={maxDob}
              dobDisplay={dobDisplay} 
              usesMonthlyIncome={usesMonthlyIncome} 
              isSelfEmployed={isSelfEmployed}
              onDobChange={handleDobChange} 
              onPanChange={handlePanChange} 
              onFieldChange={setField}
              onBack={onBack} 
              onContinue={() => void handleContinue()}
              isBusy={isBusy} 
              busyLabel={busy === 'saving' ? 'Saving…' : busy === 'rejecting' ? 'Verifying…' : 'Continue'}
            />
          ) : (
            <FinancialFields
              fields={fields} 
              errors={errors}
              isLookingUpPincode={isLookingUpPincode}
              cityFromPincode={cityFromPincode}
              submitError={submitError}
              onFieldChange={setField} 
              onCityChange={handleCityChange} 
              onConsent={setConsent}
              onBack={() => onSectionChange('profile')} 
              isSubmitting={busy === 'submitting'}
            />
          )}
        </form>
      </section>

      {busy === 'submitting' && (
        <FlowLoader
          eyebrow="Almost there" 
          title="Checking your eligibility"
          description="We save your address, run pre-checks, verify PAN, fetch CIBIL when needed, then calculate your eligible loan amount."
          steps={[
            'Saving your address', 
            'Pre-eligibility checks', 
            'PAN verification and bureau'
          ]}
        />
      )}
    </>
  );
}

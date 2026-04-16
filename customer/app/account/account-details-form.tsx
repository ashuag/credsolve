'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditBureauPoweredBy } from '@/components/account/credit-bureau-powered-by';
import { AlertBanner } from '@/components/ui/alert-banner';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { SearchableCityInput } from '@/components/ui/searchable-city-input';
import { saveApplicationDetails } from '@/lib/api/lead';
import { cn } from '@/lib/cn';
import { CUSTOMER_CREDIT_CONSENT_TEXT, type CustomerGenderValue } from '@/lib/customer-details';
import { formatDateIso, parseDobDisplay } from '@/lib/date-utils';
import { useCustomerDetailLookups } from '@/lib/use-customer-detail-lookups';
import { isValidPan, isValidPincode } from '@/lib/validators';
import {
  FORM_FIELD_CLASS as FIELD_CLASS,
  FORM_FIELD_NORMAL_CLASS as FIELD_NORMAL_CLASS,
  FORM_FIELD_ERROR_CLASS as FIELD_ERROR_CLASS,
  FORM_LABEL_CLASS as LABEL_CLASS,
  FORM_INPUT_CLASS as INPUT_CLASS,
} from '@/lib/form-styles';
import {
  getCustomerOnboardingLeadUuid,
  readCustomerOnboardingState,
  updateCustomerOnboardingState,
} from '@/lib/stores/customer-onboarding-store';

type PanErrorKind = 'not_found' | 'name_mismatch' | 'bureau_error' | null;

const PAN_ERROR_MESSAGES: Record<NonNullable<PanErrorKind>, string> = {
  not_found:
    'PAN not found in NSDL records. Please check the number and try again.',
  name_mismatch:
    'This PAN is registered to a different name. Please verify your PAN card details.',
  bureau_error:
    'PAN bureau check failed due to a network issue. Please try again — this is a temporary error.',
};

type FieldErrors = {
  fullName?: string;
  gender?: string;
  dob?: string;
  addressLine1?: string;
  currentCity?: string;
  pincode?: string;
  panNumber?: string;
  creditConsent?: string;
};

export function AccountDetailsForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<CustomerGenderValue | ''>('');
  const [dob, setDob] = useState(''); // DD/MM/YYYY display format
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [currentCity, setCurrentCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [creditConsentAccepted, setCreditConsentAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [panError, setPanError] = useState<PanErrorKind>(null);
  const { cityOptions, genderOptions, isLoading: isLoadingLookups } = useCustomerDetailLookups();

  const selectedDate = parseDobDisplay(dob);

  useEffect(() => {
    const session = readCustomerOnboardingState();
    if (!session) return;

    setFullName(session.fullName ?? '');
    setGender(session.gender ?? '');
    setAddressLine1(session.addressLine1 ?? '');
    setAddressLine2(session.addressLine2 ?? '');
    setCurrentCity(session.currentCity ?? '');
    setPincode(session.pincode ?? '');
    setCreditConsentAccepted(session.creditConsentAccepted ?? false);

    if (session.dob) {
      const [year, month, day] = session.dob.split('-');
      if (year && month && day) {
        setDob(`${day}/${month}/${year}`);
      }
    }
  }, []);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    if (submitError) setSubmitError('');
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Please enter your full name.';
    }
    if (!gender) {
      errors.gender = 'Please select your gender.';
    }
    if (!selectedDate) {
      errors.dob = 'Please enter a valid date of birth (DD/MM/YYYY).';
    }
    if (!addressLine1.trim() || addressLine1.trim().length < 5) {
      errors.addressLine1 = 'Please enter your address line 1.';
    }
    if (!currentCity.trim()) {
      errors.currentCity = 'Please enter your city.';
    }
    if (!isValidPincode(pincode)) {
      errors.pincode = 'Please enter a valid 6-digit pincode.';
    }
    if (!isValidPan(panNumber)) {
      errors.panNumber = 'Please enter a valid PAN card number (e.g. ABCDE1234F).';
    }
    if (!creditConsentAccepted) {
      errors.creditConsent = 'Please accept the consent declaration to continue.';
    }
    return errors;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    setPanError(null);

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const leadUuid = getCustomerOnboardingLeadUuid() || undefined;
    const normalizedPan = panNumber.toUpperCase();
    const normalizedAddressLine2 = addressLine2.trim();
    setIsSubmitting(true);

    try {
      const response = await saveApplicationDetails({
        leadUuid,
        fullName: fullName.trim(),
        gender,
        dob: formatDateIso(selectedDate!),
        panNumber: normalizedPan,
        addressLine1: addressLine1.trim(),
        ...(normalizedAddressLine2 ? { addressLine2: normalizedAddressLine2 } : {}),
        currentCity: currentCity.trim(),
        pincode,
      });

      updateCustomerOnboardingState({
        leadUuid: response.leadUuid ?? leadUuid,
        fullName: fullName.trim(),
        gender: gender || undefined,
        dob: formatDateIso(selectedDate!),
        addressLine1: addressLine1.trim(),
        addressLine2: normalizedAddressLine2 || undefined,
        currentCity: currentCity.trim(),
        pincode,
        creditConsentAccepted,
      });

      const panStatus = response.panResult?.status;

      if (panStatus === 'verified') {
        router.push('/account/professional');
        return;
      }

      if (panStatus === 'blacklisted') {
        router.replace('/thank-you');
        return;
      }

      setPanError((panStatus as PanErrorKind) ?? 'bureau_error');
      setIsSubmitting(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to save your details. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 items-start mt-2" noValidate>
      <label className={cn(FIELD_CLASS, fieldErrors.fullName ? FIELD_ERROR_CLASS : FIELD_NORMAL_CLASS, 'group')}>
        <span className={LABEL_CLASS}>Full name</span>
        <input
          className={INPUT_CLASS}
          type="text"
          name="fullName"
          placeholder="Enter your legal name"
          value={fullName}
          onChange={(e) => { setFullName(e.target.value); clearFieldError('fullName'); }}
          autoComplete="name"
          aria-invalid={Boolean(fieldErrors.fullName)}
          aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
          required
        />
        {fieldErrors.fullName && (
          <p id="fullName-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.fullName}</p>
        )}
      </label>

      <label className={cn(FIELD_CLASS, fieldErrors.gender ? FIELD_ERROR_CLASS : FIELD_NORMAL_CLASS, 'group')}>
        <span className={LABEL_CLASS}>Gender</span>
        <select
          className={INPUT_CLASS}
          name="gender"
          value={gender}
          onChange={(e) => { setGender(e.target.value as CustomerGenderValue | ''); clearFieldError('gender'); }}
          disabled={isLoadingLookups}
          aria-invalid={Boolean(fieldErrors.gender)}
          aria-describedby={fieldErrors.gender ? 'gender-error' : undefined}
          required
        >
          <option value="" disabled>{isLoadingLookups ? 'Loading...' : 'Select gender'}</option>
          {genderOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {fieldErrors.gender && (
          <p id="gender-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.gender}</p>
        )}
      </label>

      <div className={cn(FIELD_CLASS, fieldErrors.dob ? FIELD_ERROR_CLASS : FIELD_NORMAL_CLASS)}>
        <DatePickerField
          label="Date of birth"
          value={dob}
          onChange={(v) => { setDob(v); clearFieldError('dob'); }}
        />
        {fieldErrors.dob && (
          <p id="dob-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.dob}</p>
        )}
      </div>

      <label className={cn(FIELD_CLASS, fieldErrors.addressLine1 ? FIELD_ERROR_CLASS : FIELD_NORMAL_CLASS, 'group')}>
        <span className={LABEL_CLASS}>Address line 1</span>
        <input
          className={INPUT_CLASS}
          type="text"
          name="addressLine1"
          placeholder="Flat / House / Building / Street"
          value={addressLine1}
          onChange={(e) => { setAddressLine1(e.target.value); clearFieldError('addressLine1'); }}
          autoComplete="address-line1"
          aria-invalid={Boolean(fieldErrors.addressLine1)}
          aria-describedby={fieldErrors.addressLine1 ? 'addressLine1-error' : undefined}
          required
        />
        {fieldErrors.addressLine1 && (
          <p id="addressLine1-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.addressLine1}</p>
        )}
      </label>

      <label className={cn(FIELD_CLASS, FIELD_NORMAL_CLASS, 'group')}>
        <span className={LABEL_CLASS}>Address line 2 (optional)</span>
        <input
          className={INPUT_CLASS}
          type="text"
          name="addressLine2"
          placeholder="Area, landmark"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          autoComplete="address-line2"
        />
      </label>

      <label className={cn(FIELD_CLASS, fieldErrors.currentCity ? FIELD_ERROR_CLASS : FIELD_NORMAL_CLASS, 'group')}>
        <span className={LABEL_CLASS}>City</span>
        <SearchableCityInput
          id="currentCity"
          name="currentCity"
          value={currentCity}
          options={cityOptions}
          onChange={(v) => { setCurrentCity(v); clearFieldError('currentCity'); }}
          className={INPUT_CLASS}
          placeholder="Start typing your city"
          isLoading={isLoadingLookups}
          ariaInvalid={Boolean(fieldErrors.currentCity)}
          ariaDescribedBy={fieldErrors.currentCity ? 'currentCity-error' : undefined}
        />
        {fieldErrors.currentCity && (
          <p id="currentCity-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.currentCity}</p>
        )}
      </label>

      <label className={cn(FIELD_CLASS, fieldErrors.pincode ? FIELD_ERROR_CLASS : FIELD_NORMAL_CLASS, 'group')}>
        <span className={LABEL_CLASS}>Pincode</span>
        <input
          className={INPUT_CLASS}
          type="text"
          name="pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="400001"
          maxLength={6}
          value={pincode}
          onChange={(e) => { setPincode(e.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('pincode'); }}
          aria-invalid={Boolean(fieldErrors.pincode)}
          aria-describedby={fieldErrors.pincode ? 'pincode-error' : undefined}
          required
        />
        {fieldErrors.pincode && (
          <p id="pincode-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.pincode}</p>
        )}
      </label>

      <label className={cn(FIELD_CLASS, fieldErrors.panNumber ? FIELD_ERROR_CLASS : FIELD_NORMAL_CLASS, 'group')}>
        <span className={LABEL_CLASS}>PAN card number</span>
        <input
          className={INPUT_CLASS}
          type="text"
          name="panNumber"
          placeholder="ABCDE1234F"
          maxLength={10}
          value={panNumber}
          onChange={(e) => {
            setPanError(null);
            setPanNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
            clearFieldError('panNumber');
          }}
          autoComplete="off"
          aria-invalid={Boolean(fieldErrors.panNumber || panError)}
          aria-describedby={fieldErrors.panNumber ? 'panNumber-error' : 'panNumber-help'}
          required
        />
        <span
          id={fieldErrors.panNumber ? undefined : 'panNumber-help'}
          className="text-[0.82rem] leading-[1.55] text-brand-muted"
        >
          Must match your PAN card exactly.
        </span>
        {fieldErrors.panNumber && (
          <p id="panNumber-error" className="text-[0.82rem] leading-[1.45] text-[#b2372d]">{fieldErrors.panNumber}</p>
        )}
      </label>

      {panError && (
        <AlertBanner variant={panError === 'bureau_error' ? 'warn' : 'error'}>
          {PAN_ERROR_MESSAGES[panError]}
        </AlertBanner>
      )}

      <div className={cn(
        'grid gap-3 rounded-[22px] border px-4 py-4',
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,249,255,0.94))]',
        'shadow-[0_14px_28px_rgba(23,44,113,0.08)]',
        fieldErrors.creditConsent
          ? 'border-[rgba(193,57,43,0.32)]'
          : 'border-[rgba(18,36,79,0.1)]',
      )}>
        <label className="flex items-start gap-3">
          <input
            id="creditConsentAccepted"
            name="creditConsentAccepted"
            type="checkbox"
            checked={creditConsentAccepted}
            onChange={(e) => {
              const next = e.target.checked;
              setCreditConsentAccepted(next);
              updateCustomerOnboardingState({ creditConsentAccepted: next });
              if (next) setFieldErrors((prev) => ({ ...prev, creditConsent: undefined }));
              if (submitError) setSubmitError('');
            }}
            className="mt-1 h-4 w-4 rounded border border-[rgba(18,36,79,0.24)] accent-brand-blue"
            aria-invalid={Boolean(fieldErrors.creditConsent)}
            aria-describedby={fieldErrors.creditConsent ? 'consent-error' : 'consent-help'}
          />
          <span className="text-[0.94rem] leading-[1.65] text-brand-navy">{CUSTOMER_CREDIT_CONSENT_TEXT}</span>
        </label>
        <p
          id={fieldErrors.creditConsent ? 'consent-error' : 'consent-help'}
          className={`text-[0.875rem] leading-[1.55] ${fieldErrors.creditConsent ? 'text-[#b2372d]' : 'text-brand-muted'}`}
        >
          {fieldErrors.creditConsent ?? 'This consent is required so lending partners can complete credit checks.'}
        </p>
        <CreditBureauPoweredBy />
      </div>

      {submitError && <AlertBanner variant="error">{submitError}</AlertBanner>}

      <button
        type="submit"
        className="mc-btn-primary w-full mt-2"
        disabled={isSubmitting}
      >
        {isSubmitting
          ? 'Verifying...'
          : panError === 'bureau_error'
            ? 'Retry verification'
            : 'Save & continue'}
      </button>
    </form>
  );
}

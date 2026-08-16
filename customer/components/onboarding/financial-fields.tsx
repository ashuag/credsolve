import type { ChangeEvent } from 'react';
import { SessionRequiredAlert } from '@/components/auth/session-required-alert';
import { SearchableCityInput, type CityInputChange } from '@/components/ui/searchable-city-input';
import { cn } from '@/lib/cn';
import {
  CUSTOMER_CREDIT_CONSENT_REASSURANCE,
  CUSTOMER_CREDIT_CONSENT_TEXT,
} from '@/lib/customer-details';
import { FormInput, StickyActions, inputCls, secondaryBtn } from './_form-ui';
import type { Fields, FieldError, OnChange } from './_types';

type Props = {
  fields: Fields;
  errors: FieldError;
  isLookingUpPincode: boolean;
  cityFromPincode: boolean;
  submitError: string;
  onFieldChange: OnChange;
  onCityChange: (v: CityInputChange) => void;
  onConsent: (e: ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  isSubmitting: boolean;
};

export function FinancialFields({
  fields, errors, isLookingUpPincode, cityFromPincode,
  submitError, onFieldChange, onCityChange, onConsent, onBack, isSubmitting,
}: Props) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
        <div className="md:col-span-2">
          <FormInput id="pincode" label="Pincode" error={errors.pincode}
            type="text" inputMode="numeric" autoComplete="postal-code" placeholder="400001" maxLength={6} required
            value={fields.pincode} onChange={onFieldChange('pincode')} />
          {isLookingUpPincode && <p className="text-[0.75rem] text-slate-500 pl-1 mt-1">Looking up city for this pincode…</p>}
        </div>

        <div className="md:col-span-2 flex flex-col gap-1.5 w-full">
          <label htmlFor="currentCity" className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider pl-1">City</label>
          <SearchableCityInput id="currentCity" name="currentCity"
            value={fields.currentCity ?? ''} onChange={onCityChange}
            className={inputCls(Boolean(errors.currentCity))}
            placeholder={cityFromPincode ? 'Auto-filled from pincode' : 'Enter your city'}
            disabled={cityFromPincode || isLookingUpPincode}
            ariaInvalid={Boolean(errors.currentCity)} ariaDescribedBy={errors.currentCity ? 'currentCity-error' : undefined} />
          {errors.currentCity && <p id="currentCity-error" className="text-[#b2372d] text-[0.75rem] pl-1 font-medium m-0">{errors.currentCity}</p>}
        </div>

        <FormInput span2 id="addressLine1" label="Address line 1" error={errors.addressLine1}
          type="text" autoComplete="address-line1" placeholder="Flat / House no, Building, Street" required
          value={fields.addressLine1} onChange={onFieldChange('addressLine1')} />

        <FormInput span2 id="addressLine2" label="Address line 2" error={errors.addressLine2}
          type="text" autoComplete="address-line2" placeholder="Landmark / Area / Apartment name"
          value={fields.addressLine2} onChange={onFieldChange('addressLine2')} />
      </div>

      <div
        className={cn(
          'mt-4 md:mt-5 overflow-hidden rounded-2xl border transition-all duration-200',
          fields.creditConsentAccepted
            ? 'border-[rgba(20,150,243,0.38)] bg-[linear-gradient(180deg,rgba(20,150,243,0.09),rgba(255,255,255,0.94))] shadow-[0_10px_22px_rgba(23,44,113,0.08)]'
            : errors.creditConsentAccepted
              ? 'border-red-300 bg-red-50/70'
              : 'border-[rgba(18,36,79,0.12)] bg-[rgba(248,251,255,0.92)] hover:border-[rgba(20,150,243,0.28)]',
        )}
      >
        <label htmlFor="creditConsentAccepted" className="block cursor-pointer p-4">
         
          <div className="text-[0.85rem] leading-[1.55] text-brand-navy/80">
            <span className="relative float-left mt-[0.15rem] mr-2.5 inline-flex h-5 w-5">
              <input
                id="creditConsentAccepted"
                name="creditConsentAccepted"
                type="checkbox"
                checked={fields.creditConsentAccepted}
                onChange={onConsent}
                aria-invalid={Boolean(errors.creditConsentAccepted)}
                aria-describedby={
                  errors.creditConsentAccepted
                    ? 'creditConsentReassurance creditConsentAccepted-error'
                    : 'creditConsentReassurance'
                }
                className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
              />
              <span
                className={cn(
                  'pointer-events-none flex h-5 w-5 items-center justify-center rounded-[6px] border-2 transition-all',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-blue/35 peer-focus-visible:ring-offset-1',
                  fields.creditConsentAccepted
                    ? 'border-brand-blue bg-brand-blue text-white'
                    : 'border-slate-300 bg-white text-transparent',
                )}
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M3 8.2 6.2 11.5 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
            {CUSTOMER_CREDIT_CONSENT_TEXT}
          </div>

          <p
            id="creditConsentReassurance"
            className="mt-3 clear-both m-0 flex items-start gap-2 rounded-xl bg-[rgba(36,168,111,0.1)] px-3 py-2.5 text-[0.8rem] font-semibold leading-snug text-[#17624a]"
          >
            <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            {CUSTOMER_CREDIT_CONSENT_REASSURANCE}
          </p>
        </label>
        {errors.creditConsentAccepted && (
          <p id="creditConsentAccepted-error" className="m-0 border-t border-red-200 px-4 py-2.5 text-[0.8rem] font-semibold text-[#b2372d]">
            {errors.creditConsentAccepted}
          </p>
        )}
      </div>

      {submitError && <SessionRequiredAlert message={submitError} />}

      <StickyActions>
        <button type="button" onClick={onBack} className={secondaryBtn}>← Back</button>
        <button type="submit" className="mc-btn-primary flex-1" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Complete application'}
        </button>
      </StickyActions>
    </div>
  );
}

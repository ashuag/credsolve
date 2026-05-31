import type { ChangeEvent } from 'react';
import { SessionRequiredAlert } from '@/components/auth/session-required-alert';
import { SearchableCityInput, type CityInputChange } from '@/components/ui/searchable-city-input';
import { CUSTOMER_CREDIT_CONSENT_TEXT } from '@/lib/customer-details';
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
            value={fields.currentCity} onChange={onCityChange}
            className={inputCls(Boolean(errors.currentCity))}
            placeholder={cityFromPincode ? 'Auto-filled from pincode' : 'Type 2+ chars to search city'}
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

      <div className="mt-4 md:mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <label className="flex items-start gap-3 cursor-pointer">
          <input id="creditConsentAccepted" name="creditConsentAccepted" type="checkbox"
            checked={fields.creditConsentAccepted} onChange={onConsent}
            className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          <span className="text-[0.85rem] leading-relaxed text-slate-600">{CUSTOMER_CREDIT_CONSENT_TEXT}</span>
        </label>
        {errors.creditConsentAccepted && (
          <p id="creditConsentAccepted-error" className="mt-2 text-[#b2372d] text-sm font-medium">{errors.creditConsentAccepted}</p>
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

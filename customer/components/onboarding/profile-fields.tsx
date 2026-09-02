import type { ChangeEvent } from 'react';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { FormInput, FormSelect, LockedValue, StickyActions } from './_form-ui';
import type { Fields, FieldError, SelectOption, OnChange } from './_types';

type Props = {
  fields: Fields;
  errors: FieldError;
  genderOptions: SelectOption[];
  occupationOptions: SelectOption[];
  isLoadingLookups: boolean;
  maxDob: Date;
  dobDisplay: string;
  onDobChange: (v: string) => void;
  onPanChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFieldChange: OnChange;
  onBack: () => void;
  onContinue: () => void;
  isBusy: boolean;
  busyLabel: string;
  /** Recurring customer: name, gender, DOB, and PAN cannot be changed. */
  lockIdentityFields?: boolean;
};

const inrField = { type: 'text' as const, inputMode: 'numeric' as const, placeholder: 'Enter amount in INR', required: true };

export function ProfileFields({
  fields, errors, genderOptions, occupationOptions, isLoadingLookups, maxDob,
  dobDisplay,
  onDobChange, onPanChange, onFieldChange, onBack, onContinue, isBusy, busyLabel,
  lockIdentityFields = false,
}: Props) {
  const genderLabel = genderOptions.find((o) => o.value === fields.gender)?.label ?? fields.gender;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
        {lockIdentityFields ? (
          <>
            <LockedValue span2 labelSentenceCase label="Full name as per PAN card" value={fields.fullName} />
            <LockedValue label="Gender" value={genderLabel} />
            <LockedValue label="Date of birth" value={dobDisplay} />
            <LockedValue span2 label="PAN" value={fields.panNumber} />
          </>
        ) : (
          <>
            <FormInput
              span2 labelSentenceCase id="fullName" label="Full name as per PAN card" error={errors.fullName}
              type="text" autoComplete="name" placeholder="XXX YYY" required
              className="uppercase placeholder:normal-case"
              value={fields.fullName} onChange={onFieldChange('fullName')}
            />

            <FormSelect id="gender" label="Gender" error={errors.gender} value={fields.gender} onChange={onFieldChange('gender')} disabled={isLoadingLookups}>
              <option value="">{isLoadingLookups ? 'Loading gender...' : 'Select gender'}</option>
              {genderOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </FormSelect>

            <div className="flex flex-col gap-1.5 w-full">
              <label htmlFor="dob" className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider pl-1">Date of birth</label>
              <DatePickerField id="dob" name="dob" label="Date of birth" showInputLabel={false}
                value={dobDisplay} onChange={onDobChange} maxDate={maxDob} hint=""
                ariaInvalid={Boolean(errors.dob)} ariaDescribedBy={errors.dob ? 'dob-error' : undefined} />
              {errors.dob && <p id="dob-error" className="text-[#b2372d] text-[0.75rem] pl-1 font-medium m-0">{errors.dob}</p>}
            </div>

            <FormInput
              span2 id="panNumber" label="PAN" error={errors.panNumber}
              type="text" autoComplete="off" placeholder="ABCDE1234F" maxLength={10} required
              value={fields.panNumber} onChange={onPanChange}
            />
          </>
        )}

        <FormSelect span2 id="occupation" label="Occupation" error={errors.occupation} value={fields.occupation} onChange={onFieldChange('occupation')} disabled={isLoadingLookups}>
          <option value="">{isLoadingLookups ? 'Loading occupations...' : 'Select occupation'}</option>
          {occupationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </FormSelect>

        <FormInput span2 id="monthlyIncome" error={errors.monthlyIncome}
          label="Monthly income"
          value={fields.monthlyIncome} onChange={onFieldChange('monthlyIncome')} {...inrField} />
      </div>

      <StickyActions>
        <button type="button" onClick={onContinue} disabled={isBusy} aria-busy={isBusy}
          className="mc-btn-primary flex-1 disabled:opacity-60 disabled:cursor-not-allowed">
          <span className="inline-flex items-center justify-center gap-2.5">
            {isBusy && <span className="w-4.5 h-4.5 shrink-0 rounded-full border-2 border-[rgba(255,248,223,0.28)] border-t-[#fff8df] animate-spin-btn" aria-hidden />}
            <span>{busyLabel}</span>
          </span>
        </button>
      </StickyActions>
    </div>
  );
}

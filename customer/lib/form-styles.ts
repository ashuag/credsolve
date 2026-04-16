/**
 * Shared Tailwind class strings for the "floating card" input style used in
 * account-details-form and professional-details-form.
 *
 * Usage:
 *   cn(FORM_FIELD_CLASS, hasError ? FORM_FIELD_ERROR_CLASS : FORM_FIELD_NORMAL_CLASS, 'group')
 */

/** Base field container — lift + shadow on focus-within. Compose with NORMAL or ERROR. */
export const FORM_FIELD_CLASS =
  'relative overflow-hidden grid gap-2 p-3 rounded-[20px] border border-[rgba(18,36,79,0.08)] bg-white shadow-[0_12px_24px_rgba(23,44,113,0.05)] transition-all duration-[220ms] focus-within:-translate-y-0.5 focus-within:shadow-[0_22px_40px_rgba(23,44,113,0.1),0_0_0_6px_rgba(20,150,243,0.07)]';

/** Blue border on focus for valid/normal fields. */
export const FORM_FIELD_NORMAL_CLASS = 'focus-within:border-[rgba(20,150,243,0.2)]';

/** Red border (static + on focus) for fields with a validation error. */
export const FORM_FIELD_ERROR_CLASS =
  'border-[rgba(193,57,43,0.32)] shadow-[0_0_0_3px_rgba(193,57,43,0.06)] focus-within:border-[rgba(193,57,43,0.4)]';

/** Floating label inside a field container. */
export const FORM_LABEL_CLASS =
  'text-[0.84rem] font-extrabold text-brand-navy transition-colors duration-[180ms] group-focus-within:text-brand-blue group-focus-within:-translate-y-px';

/** Input or select element inside a field container. */
export const FORM_INPUT_CLASS =
  'w-full min-h-[56px] px-4 py-[14px] border border-[rgba(18,36,79,0.16)] rounded-[16px] bg-white text-brand-navy font-[inherit] caret-brand-blue shadow-[0_10px_18px_rgba(23,44,113,0.04)] transition-all duration-[160ms] placeholder:text-[rgba(94,103,130,0.86)] focus:outline-none focus:border-[rgba(20,150,243,0.45)] focus:shadow-[0_0_0_4px_rgba(20,150,243,0.12),0_16px_28px_rgba(23,44,113,0.1)] focus:translate-x-0.5 focus:animate-account-border-pulse';

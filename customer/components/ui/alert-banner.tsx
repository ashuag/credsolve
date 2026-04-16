import type { ReactNode } from 'react';

type AlertVariant = 'error' | 'success' | 'warn';

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error:   'text-[#b2372d] bg-[rgba(193,57,43,0.08)]   border-[rgba(193,57,43,0.18)]',
  success: 'text-[#17624a] bg-[rgba(36,168,111,0.1)]   border-[rgba(36,168,111,0.18)]',
  warn:    'text-brand-navy bg-[rgba(255,197,25,0.18)]  border-[rgba(255,197,25,0.28)]',
};

type AlertBannerProps = {
  variant: AlertVariant;
  children: ReactNode;
};

/** Styled notification banner for error, success, or warning messages. */
export function AlertBanner({ variant, children }: AlertBannerProps) {
  return (
    <div
      className={`p-3 px-[14px] rounded-[16px] text-[0.94rem] leading-[1.55] border ${VARIANT_CLASSES[variant]}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}

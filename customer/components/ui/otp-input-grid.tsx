'use client';

import type { RefObject, KeyboardEvent } from 'react';

const OTP_LENGTH = 6;

type OtpInputGridProps = {
  digits: string[];
  inputRefs: RefObject<Array<HTMLInputElement | null>>;
  onDigitChange: (index: number, value: string) => void;
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (value: string) => void;
  /** Optional aria-label for the containing div. */
  ariaLabel?: string;
};

/**
 * Six-slot OTP input grid with keyboard navigation, paste support, and
 * auto-advance focus. Pairs with the `useOtpInput` hook.
 */
export function OtpInputGrid({
  digits,
  inputRefs,
  onDigitChange,
  onKeyDown,
  onPaste,
  ariaLabel = 'OTP code input',
}: OtpInputGridProps) {
  return (
    <div
      className="grid gap-[10px] max-sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${OTP_LENGTH}, minmax(0, 1fr))` }}
      aria-label={ariaLabel}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          onChange={(e) => onDigitChange(index, e.target.value)}
          onKeyDown={(e) => onKeyDown(index, e)}
          onPaste={(e) => {
            e.preventDefault();
            onPaste(e.clipboardData.getData('text'));
          }}
          className="w-full min-h-[56px] rounded-[16px] border border-[rgba(18,36,79,0.16)] bg-white text-brand-navy text-center text-[1.35rem] font-extrabold outline-0 shadow-[0_10px_18px_rgba(23,44,113,0.04)] transition-all duration-[180ms] focus:border-[rgba(20,150,243,0.46)] focus:shadow-[0_0_0_4px_rgba(20,150,243,0.12),0_16px_28px_rgba(23,44,113,0.1)] focus:-translate-y-0.5 focus:scale-[1.04] focus:animate-otp-border-pulse max-sm:min-h-[50px]"
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
}

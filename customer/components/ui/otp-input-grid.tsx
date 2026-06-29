'use client';

import type { RefObject, KeyboardEvent } from 'react';

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
      className="grid w-full min-w-0 max-w-full grid-cols-6 gap-2 overflow-hidden sm:gap-[10px]"
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
          className="box-border w-full min-w-0 min-h-[50px] rounded-[14px] border border-[rgba(18,36,79,0.16)] bg-white text-brand-navy text-center text-[1.15rem] font-extrabold outline-0 shadow-[0_10px_18px_rgba(23,44,113,0.04)] transition-[border-color,box-shadow] duration-[180ms] focus:border-[rgba(20,150,243,0.46)] focus:shadow-[0_0_0_3px_rgba(20,150,243,0.12)] sm:min-h-[56px] sm:rounded-[16px] sm:text-[1.35rem]"
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
}

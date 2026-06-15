import { useRef, useState, type KeyboardEvent } from 'react';

const OTP_LENGTH = 6;

export type UseOtpInputReturn = {
  digits: string[];
  inputRefs: React.RefObject<Array<HTMLInputElement | null>>;
  updateDigit: (index: number, rawValue: string) => void;
  handleKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  handlePaste: (value: string) => void;
  clear: () => void;
  joined: string;
};

/**
 * Manages state and keyboard interactions for a fixed-length OTP input grid.
 * Clears error/status side-effects via optional callbacks.
 */
export function useOtpInput(onInteract?: () => void): UseOtpInputReturn {
  const [digits, setDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ''));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function updateDigit(index: number, rawValue: string) {
    const next = rawValue.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const updated = [...prev];
      updated[index] = next;
      return updated;
    });
    if (next && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    onInteract?.();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(value: string) {
    const nextDigits = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    if (!nextDigits.length) return;
    setDigits(Array.from({ length: OTP_LENGTH }, (_, i) => nextDigits[i] ?? ''));
    inputRefs.current[Math.min(nextDigits.length, OTP_LENGTH - 1)]?.focus();
    onInteract?.();
  }

  function clear() {
    setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
    inputRefs.current[0]?.focus();
  }

  return { digits, inputRefs, updateDigit, handleKeyDown, handlePaste, clear, joined: digits.join('') };
}

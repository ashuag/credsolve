'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';

const DEFAULT_SECONDS = 5;
const LOGIN_PATH = '/my-account?mode=login';

type LoggedOutRedirectModalProps = {
  /** Where to send the customer after countdown (defaults to My Account login). */
  loginPath?: string;
  /** Starting countdown value in seconds. */
  seconds?: number;
};

/**
 * Full-screen modal shown when the session cookie is gone but the UI still looks signed in.
 * Clears local session and redirects to login after a short countdown.
 */
export function LoggedOutRedirectModal({
  loginPath = LOGIN_PATH,
  seconds = DEFAULT_SECONDS,
}: LoggedOutRedirectModalProps) {
  const router = useRouter();
  const { signOut } = useCustomerSession();
  const [remaining, setRemaining] = useState(seconds);
  const [mounted, setMounted] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      if (finished.current) return;
      finished.current = true;
      void (async () => {
        try {
          await signOut();
        } catch {
          /* cookie may already be gone */
        }
        router.replace(loginPath);
      })();
      return;
    }

    const timer = window.setTimeout(() => {
      setRemaining((n) => n - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [remaining, router, loginPath, signOut]);

  const goNow = () => {
    if (finished.current) return;
    finished.current = true;
    void (async () => {
      try {
        await signOut();
      } catch {
        /* ignore */
      }
      router.replace(loginPath);
    })();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(10,22,40,0.55)] px-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="logged-out-title"
      aria-describedby="logged-out-desc"
    >
      <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[rgba(23,44,113,0.12)] bg-white shadow-[0_28px_64px_rgba(18,36,79,0.28)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#1c347d] via-[#1496f3] to-[#ffc519]" aria-hidden />
        <div className="px-6 py-7 sm:px-8 sm:py-8">
          <p className="m-0 text-[0.65rem] font-black uppercase tracking-[0.16em] text-brand-muted">
            Session ended
          </p>
          <h2
            id="logged-out-title"
            className="mt-2 text-[1.45rem] font-black tracking-tight text-brand-navy sm:text-[1.6rem]"
          >
            You are logged out
          </h2>
          <p id="logged-out-desc" className="mt-2 text-[0.95rem] leading-relaxed text-brand-muted">
            Your session is no longer active. Redirecting to the login page in{' '}
            <span className="font-extrabold tabular-nums text-brand-navy">{remaining}</span>
            {remaining === 1 ? ' second' : ' seconds'}…
          </p>

          <div className="mt-6 flex items-center justify-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(20,150,243,0.1)] text-[1.75rem] font-black tabular-nums text-brand-navy ring-1 ring-[rgba(20,150,243,0.2)]"
              aria-live="polite"
              aria-atomic="true"
            >
              {remaining}
            </div>
          </div>

          <button
            type="button"
            onClick={goNow}
            className="mc-btn-primary mt-7 flex w-full items-center justify-center py-3.5 text-[0.95rem]"
          >
            Go to login now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

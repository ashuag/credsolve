'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { logoutCustomerSession } from '@/lib/api/auth';
import { getAuthenticatedCustomerDisplayLabel } from '@/lib/customer-auth';
import { useCustomerSession } from '@/lib/hooks/use-customer-session';
import { useOutsideClick } from '@/lib/hooks/use-outside-click';
import { buildHrefWithSearch } from '@/lib/navigation';
import { clearCustomerSessionStoreSession } from '@/lib/stores/customer-session-store';

const APPLY_ACTION = {
  href: '/apply-for-loan',
  eyebrow: 'New customer',
  title: 'Apply for a loan',
  description: 'Start a fresh application with mobile OTP, eligibility checks, and a guided digital journey.',
  accent: 'bg-[linear-gradient(135deg,#1c347d_0%,#12244f_100%)] text-[#fff8df] shadow-[0_18px_36px_rgba(23,44,113,0.22)]',
};

const LOGIN_ACTION = {
  href: '/my-account?mode=login',
  eyebrow: 'Existing customer',
  title: 'Login',
  description: 'Use your registered mobile number to resume your application and check your MoneyCash status.',
  accent: 'border border-[rgba(18,36,79,0.1)] bg-[rgba(255,255,255,0.82)] text-brand-navy shadow-[0_14px_28px_rgba(23,44,113,0.08)]',
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10h12M10 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeChoicePanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { profile, hasHydrated } = useCustomerSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const applyHref = buildHrefWithSearch(APPLY_ACTION.href, searchParams);
  const loginHref = buildHrefWithSearch('/my-account', searchParams, { mode: 'login' });

  useOutsideClick(menuRef, () => setIsMenuOpen(false), isMenuOpen);

  async function handleLogout() {
    try {
      await logoutCustomerSession();
    } catch {
      // Best-effort server logout — always clear client state so the user is not stuck
    }

    clearCustomerSessionStoreSession();
    setIsMenuOpen(false);
    router.refresh();
  }

  return (
    <section className="mc-card mc-card-glow" aria-labelledby="journey-choice-heading">
      <div className="mb-[18px] grid gap-[10px]">
        <div className="mc-chip">Choose your journey</div>
        <h2
          id="journey-choice-heading"
          className="m-0 text-[clamp(1.8rem,5vw,2.2rem)] tracking-[-0.04em] text-brand-navy"
        >
          Apply for a loan or login.
        </h2>
        <p className="m-0 leading-[1.6] text-brand-muted">
          Pick the path you need on the right, then continue with the same secure MoneyCash onboarding flow.
        </p>
      </div>

      <div className="grid gap-3">
        {/* Apply CTA */}
        <Link
          href={applyHref}
          className={`group grid gap-3 rounded-[24px] p-[18px] transition-all duration-[180ms] hover:-translate-y-[2px] hover:shadow-[0_20px_34px_rgba(23,44,113,0.16)] ${APPLY_ACTION.accent}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.78rem] font-bold uppercase tracking-[0.14em] opacity-75">{APPLY_ACTION.eyebrow}</div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-current/15 bg-current/10">
              <ArrowIcon />
            </span>
          </div>
          <div>
            <strong className="block text-[1.2rem] leading-[1.2]">{APPLY_ACTION.title}</strong>
            <span className="mt-2 block text-[0.95rem] leading-[1.6] opacity-85">{APPLY_ACTION.description}</span>
          </div>
        </Link>

        {/* Login / authenticated panel */}
        {hasHydrated && profile ? (
          <div
            ref={menuRef}
            className="relative rounded-[24px] border border-[rgba(18,36,79,0.1)] bg-[rgba(255,255,255,0.82)] p-[18px] text-brand-navy shadow-[0_14px_28px_rgba(23,44,113,0.08)]"
          >
            <button
              type="button"
              className="grid w-full gap-3 text-left"
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.14em] text-brand-blue">Welcome back</div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(18,36,79,0.08)] bg-[rgba(20,150,243,0.08)]">
                  <ChevronIcon open={isMenuOpen} />
                </span>
              </div>
              <div>
                <strong className="block text-[1.2rem] leading-[1.2]">
                  Hello, {getAuthenticatedCustomerDisplayLabel(profile)}
                </strong>
                <span className="mt-2 block text-[0.95rem] leading-[1.6] text-brand-muted">
                  Your customer account is active. Open the menu to logout.
                </span>
              </div>
            </button>

            {isMenuOpen && (
              <div
                className="absolute left-0 right-0 top-[calc(100%+10px)] z-10 rounded-[20px] border border-[rgba(18,36,79,0.12)] bg-white p-2 shadow-[0_22px_48px_rgba(23,44,113,0.18)]"
                role="menu"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-[16px] px-4 py-3 text-left text-[0.95rem] font-extrabold text-brand-navy transition-colors duration-150 hover:bg-[rgba(18,36,79,0.05)]"
                  onClick={handleLogout}
                  role="menuitem"
                >
                  <span>Logout</span>
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                    <path d="M8 5L13 10L8 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href={loginHref}
            className={`group grid gap-3 rounded-[24px] p-[18px] transition-all duration-[180ms] hover:-translate-y-[2px] hover:shadow-[0_20px_34px_rgba(23,44,113,0.16)] ${LOGIN_ACTION.accent}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[0.78rem] font-bold uppercase tracking-[0.14em] opacity-75">{LOGIN_ACTION.eyebrow}</div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-current/15 bg-current/10">
                <ArrowIcon />
              </span>
            </div>
            <div>
              <strong className="block text-[1.2rem] leading-[1.2]">{LOGIN_ACTION.title}</strong>
              <span className="mt-2 block text-[0.95rem] leading-[1.6] opacity-85">{LOGIN_ACTION.description}</span>
            </div>
          </Link>
        )}
      </div>

      <div className="mt-[18px] grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <div className="mc-inner-card grid gap-1">
          <span className="text-[0.78rem] font-bold uppercase tracking-[0.11em] text-brand-blue">Fast start</span>
          <strong className="text-brand-navy">Pick your path first</strong>
        </div>
        <div className="mc-inner-card grid gap-1">
          <span className="text-[0.78rem] font-bold uppercase tracking-[0.11em] text-brand-blue">Secure access</span>
          <strong className="text-brand-navy">OTP-based verification</strong>
        </div>
      </div>
    </section>
  );
}

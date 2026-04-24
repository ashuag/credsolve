'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { getCustomerJourneyResumePath, hasActiveLoanLead } from '@/lib/api/customer-session';
import { buildHrefWithSearch } from '@/lib/navigation';

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

const RESUME_ACTION = {
  eyebrow: 'Existing customer',
  title: 'Resume application',
  description: 'Continue from the exact step where you left your MoneyCash journey.',
  accent: 'border border-[rgba(18,36,79,0.1)] bg-[rgba(255,255,255,0.82)] text-brand-navy shadow-[0_14px_28px_rgba(23,44,113,0.08)]',
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10h12M10 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeChoicePanel() {
  const searchParams = useSearchParams();
  const { loading, session } = useCustomerSession();
  const hasActiveLead = hasActiveLoanLead(session);
  const sessionResolved = !loading;

  const applyHref = buildHrefWithSearch(APPLY_ACTION.href, searchParams);
  const loginHref = buildHrefWithSearch('/my-account', searchParams, { mode: 'login' });
  const resumeHref = buildHrefWithSearch(getCustomerJourneyResumePath(session), searchParams);
  const showApplyCard = sessionResolved && !hasActiveLead;

  return (
    <section className="mc-card mc-card-glow" aria-labelledby="journey-choice-heading">
      <div className="mb-[18px] grid gap-[10px]">
        <div className="mc-chip">Choose your journey</div>
        <h2
          id="journey-choice-heading"
          className="m-0 text-[clamp(1.8rem,5vw,2.2rem)] tracking-[-0.04em] text-brand-navy"
        >
          {!sessionResolved ? 'Checking your journey...' : showApplyCard ? 'Apply for a loan or login.' : 'Welcome back'}
        </h2>
        <p className="m-0 leading-[1.6] text-brand-muted">
          {!sessionResolved
            ? 'Please wait while we load your secure customer session.'
            : showApplyCard
            ? 'Pick the path you need on the right, then continue with the same secure MoneyCash onboarding flow.'
            : 'You already have an application in progress. Login to continue.'}
        </p>
      </div>

      <div className="grid gap-3">
        {showApplyCard && (
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
        )}

        {sessionResolved && hasActiveLead ? (
          <Link
            href={resumeHref}
            className={`group grid gap-3 rounded-[24px] p-[18px] transition-all duration-[180ms] hover:-translate-y-[2px] hover:shadow-[0_20px_34px_rgba(23,44,113,0.16)] ${RESUME_ACTION.accent}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[0.78rem] font-bold uppercase tracking-[0.14em] opacity-75">{RESUME_ACTION.eyebrow}</div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-current/15 bg-current/10">
                <ArrowIcon />
              </span>
            </div>
            <div>
              <strong className="block text-[1.2rem] leading-[1.2]">{RESUME_ACTION.title}</strong>
              <span className="mt-2 block text-[0.95rem] leading-[1.6] opacity-85">{RESUME_ACTION.description}</span>
            </div>
          </Link>
        ) : sessionResolved ? (
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
        ) : (
          <div
            aria-hidden
            className="rounded-[24px] p-[18px] border border-[rgba(18,36,79,0.08)] bg-[rgba(255,255,255,0.82)] min-h-[164px] animate-pulse"
          />
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

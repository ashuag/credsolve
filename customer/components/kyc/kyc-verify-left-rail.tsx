'use client';

import type { CustomerPortalProfile } from '@/lib/api/customer-session';
import { formatIsoDateDdMmYyyy } from '@/lib/format-date';

type KycVerifyLeftRailProps = {
  profile: CustomerPortalProfile | null;
};

const KYC_STEPS = [
  { n: '1', label: 'DigiLocker', hint: 'Share Aadhaar' },
  { n: '2', label: 'Selfie', hint: 'Confirm it is you' },
  { n: '3', label: 'Done', hint: 'Continue to bank' },
] as const;

export function KycVerifyLeftRail({ profile }: KycVerifyLeftRailProps) {
  const name = profile?.fullName?.trim() || '—';
  const dob = formatIsoDateDdMmYyyy(profile?.dob);

  return (
    <div className="w-full max-w-[340px] max-h-full overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-md">
      <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-blue-200">
        Must match Aadhaar
      </p>
      <dl className="mt-3 grid gap-3 m-0">
        <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
          <dt className="m-0 text-[0.68rem] font-bold uppercase tracking-wider text-white/60">Full name</dt>
          <dd className="m-0 mt-1.5 text-[1.02rem] font-black leading-snug tracking-tight text-white">{name}</dd>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
          <dt className="m-0 text-[0.68rem] font-bold uppercase tracking-wider text-white/60">Date of birth</dt>
          <dd className="m-0 mt-1.5 text-[1.02rem] font-black tracking-tight text-white">{dob}</dd>
        </div>
      </dl>

      <p className="mb-2 mt-4 text-[0.65rem] font-black uppercase tracking-[0.14em] text-blue-200">
        This step
      </p>
      <ol className="m-0 grid list-none gap-2 p-0">
        {KYC_STEPS.map((step) => (
          <li key={step.n} className="flex items-center gap-3">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[0.75rem] font-extrabold text-white">
              {step.n}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.88rem] font-extrabold leading-none text-white">{step.label}</span>
              <span className="mt-0.5 block text-[0.72rem] font-medium text-white/50">{step.hint}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

'use client';

import type { CustomerPortalProfile } from '@/lib/api/customer-session';
import { formatIsoDateDdMmYyyy } from '@/lib/format-date';

type KycVerifyLeftRailProps = {
  profile: CustomerPortalProfile | null;
};

export function KycVerifyLeftRail({ profile }: KycVerifyLeftRailProps) {
  const name = profile?.fullName?.trim() || '—';
  const dob = formatIsoDateDdMmYyyy(profile?.dob);

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
      <p className="m-0 text-[0.72rem] font-[800] uppercase tracking-[0.14em] text-[#1496f3]">
        Application profile
      </p>
      <p className="mt-2 mb-0 text-[0.88rem] leading-relaxed text-slate-300 font-[500]">
        These details must match your Aadhaar exactly.
      </p>
      <dl className="mt-4 grid gap-3 m-0">
        <div className="flex flex-col gap-1 border-b border-white/[0.07] pb-3">
          <dt className="m-0 text-[0.78rem] font-[700] uppercase tracking-[0.1em] text-slate-400">Full name</dt>
          <dd className="m-0 text-[1.05rem] font-[800] text-white tracking-tight leading-snug">{name}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="m-0 text-[0.78rem] font-[700] uppercase tracking-[0.1em] text-slate-400">
            Date of birth
          </dt>
          <dd className="m-0 text-[1.05rem] font-[800] text-white tracking-tight">{dob}</dd>
        </div>
      </dl>
    </div>
  );
}

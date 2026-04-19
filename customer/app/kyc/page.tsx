'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function KycPage() {
  const router = useRouter();

  return (
    <div className="grid gap-[18px] nav:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <div className="mc-card grid gap-5">
        <div className="mc-chip">KYC step</div>
        <h1 className="m-0 text-brand-navy text-[clamp(2rem,5vw,3rem)] tracking-[-0.05em] leading-[1.08]">
          Complete your KYC.
        </h1>
        <p className="m-0 text-brand-muted leading-[1.7]">
          Choose one option to continue with verification.
        </p>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => router.push('/bank-details')}
            className="group grid gap-2 rounded-[22px] p-4 border border-[rgba(18,36,79,0.12)] bg-[rgba(255,255,255,0.86)] text-left hover:-translate-y-[1px] transition"
          >
            <strong className="text-brand-navy text-[1.05rem]">Login with DigiLocker</strong>
            <span className="text-brand-muted text-[0.92rem] leading-[1.6]">
              Continue using DigiLocker flow (quick path).
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/kyc/upload-documents')}
            className="group grid gap-2 rounded-[22px] p-4 border border-[rgba(18,36,79,0.12)] bg-[rgba(255,255,255,0.86)] text-left hover:-translate-y-[1px] transition"
          >
            <strong className="text-brand-navy text-[1.05rem]">Upload documents</strong>
            <span className="text-brand-muted text-[0.92rem] leading-[1.6]">
              Upload PAN and Aadhaar details manually.
            </span>
          </button>
        </div>

        <Link href="/loan-selection" className="mc-btn-secondary self-start">
          Back
        </Link>
      </div>
    </div>
  );
}


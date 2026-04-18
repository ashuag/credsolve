'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';

export function BrandHeader() {
  const searchParams = useSearchParams();

  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const loginHref = buildHrefWithSearch('/my-account', searchParams, { mode: 'login' });

  return (
    <header className="sticky top-0 z-20 border-b border-b-[rgba(18,36,79,0.09)] bg-[rgba(255,253,248,0.88)] backdrop-blur-[18px] shadow-[0_2px_24px_rgba(23,44,113,0.06)]">
      <div className="flex items-center justify-between gap-4 py-[10px] mx-auto max-w-[min(1180px,calc(100%-24px))]">
        <Link href="/" className="inline-flex items-center shrink-0" aria-label="MoneyCash home">
          <Image
            src="/images/moneycash-logo.jpeg"
            alt="MoneyCash Instant Digital Loans"
            width={536}
            height={136}
            sizes="(max-width: 720px) 40vw, 180px"
            priority
            className="w-[clamp(130px,22vw,180px)] h-auto block rounded-[10px]"
          />
        </Link>

        <nav className="hidden sm:flex items-center gap-2" aria-label="Primary">
          <Link
            href={applyHref}
            className="inline-flex items-center justify-center min-h-[40px] px-[18px] py-[9px] rounded-full border border-[rgba(18,36,79,0.12)] bg-[rgba(255,255,255,0.82)] font-extrabold text-[0.94rem] text-brand-navy shadow-[0_8px_20px_rgba(23,44,113,0.08)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(23,44,113,0.14)]"
          >
            Apply for a loan
          </Link>

          <Link
            href={loginHref}
            className="inline-flex items-center justify-center min-h-[40px] px-[22px] py-[9px] rounded-full font-extrabold text-[0.94rem] text-[#fff8df] bg-[linear-gradient(135deg,#1c347d_0%,#12244f_100%)] shadow-[0_8px_24px_rgba(23,44,113,0.22)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(23,44,113,0.3)]"
          >
            Log in
          </Link>
        </nav>
      </div>
    </header>
  );
}

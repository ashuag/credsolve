import Link from 'next/link';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

type BrandLogoProps = {
  href?: string;
  className?: string;
  /** Compact = icon + short name; full adds tagline; capsule = dark navy pill badge from design. */
  variant?: 'mark' | 'full' | 'capsule';
  inverted?: boolean;
};

/**
 * CredSolve wordmark — supports capsule pill badge and standard mark.
 */
export function BrandLogo({
  href = '/',
  className = '',
  variant = 'capsule',
  inverted = false,
}: BrandLogoProps) {
  if (variant === 'capsule') {
    const capsuleInner = (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#0B1E3D] px-4 py-2 text-white shadow-sm transition-transform hover:scale-[1.02] sm:px-5 sm:py-2.5 ${className}`}>
        <span className="text-[1.15rem] font-[900] tracking-tight sm:text-[1.32rem]">
          <span className="text-white">Cred</span>
          <span className="text-[#22C55E]">Solve</span>
        </span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[#22C55E] sm:h-5 sm:w-5" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    );
    if (!href) return capsuleInner;
    return (
      <Link href={href} className="inline-flex shrink-0" aria-label={`${BRAND_NAME} home`}>
        {capsuleInner}
      </Link>
    );
  }
  const nameFirstColor = inverted ? 'text-white' : 'text-[#0F2748]';

  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#22C55E] text-white shadow-[0_4px_14px_rgba(34,197,94,0.35)] sm:h-10 sm:w-10"
        aria-hidden
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[1.15rem] font-[900] tracking-tight sm:text-[1.35rem]">
          <span className={nameFirstColor}>Cred</span>
          <span className="text-[#22C55E]">Solve</span>
        </span>
        {variant === 'full' ? (
          <span className={`mt-1 hidden text-[0.62rem] font-[700] uppercase tracking-[0.16em] sm:block ${inverted ? 'text-white/55' : 'text-[#0F2748]/45'}`}>
            {BRAND_TAGLINE}
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!href) {
    return inner;
  }

  return (
    <Link href={href} className="inline-flex shrink-0 transition-transform duration-200 hover:scale-[1.02]" aria-label={`${BRAND_NAME} home`}>
      {inner}
    </Link>
  );
}

'use client';

import Link from 'next/link';
import { ELIGIBILITY_SECTION_DEFINITIONS } from './eligibility-definitions';
import { cx } from '@/lib/cx';

export function EligibilityOverviewPanel() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {ELIGIBILITY_SECTION_DEFINITIONS.map((section) => (
        <Link
          key={section.slug}
          href={section.href}
          className={cx(
            'group rounded-[18px] border border-[rgba(23,44,113,0.1)] p-5 no-underline transition-transform',
            'hover:-translate-y-[1px] hover:border-[rgba(20,150,243,0.26)]',
          )}
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(240,246,255,0.95))' }}
        >
          <span className="block text-[0.72rem] font-extrabold tracking-[0.14em] uppercase text-brand-blue">
            Eligibility Criteria
          </span>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-[1.15rem] font-extrabold tracking-[-0.03em] text-brand-navy">
                {section.label}
              </h2>
              <p className="m-0 mt-2 text-[0.88rem] leading-[1.55] text-brand-muted">
                {section.description}
              </p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-[rgba(255,255,255,0.92)] text-brand-navy transition-transform group-hover:translate-x-[2px]">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[rgba(23,44,113,0.08)] bg-[rgba(255,255,255,0.84)] px-3 py-1 text-[0.77rem] font-bold text-brand-navy">
              Edit Values
            </span>
            <span className="rounded-full border border-[rgba(23,44,113,0.08)] bg-[rgba(255,255,255,0.84)] px-3 py-1 text-[0.77rem] font-bold text-brand-navy">
              Active / Inactive
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

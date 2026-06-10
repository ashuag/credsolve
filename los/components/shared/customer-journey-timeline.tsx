'use client';

import { journeyProgressPercent, type JourneyStep } from '@/lib/customer-journey';

function stepColors(state: JourneyStep['state']) {
  switch (state) {
    case 'done':
      return {
        dot: 'bg-emerald-500 ring-emerald-200',
        line: 'bg-emerald-400',
        text: 'text-emerald-800',
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'active':
      return {
        dot: 'bg-brand-blue ring-sky-200 scale-110',
        line: 'bg-brand-blue/40',
        text: 'text-brand-navy',
        badge: 'bg-sky-50 text-brand-navy border-sky-200',
      };
    case 'failed':
      return {
        dot: 'bg-red-500 ring-red-200',
        line: 'bg-red-300',
        text: 'text-red-800',
        badge: 'bg-red-50 text-red-800 border-red-200',
      };
    default:
      return {
        dot: 'bg-slate-200 ring-slate-100',
        line: 'bg-slate-200',
        text: 'text-brand-muted',
        badge: 'bg-slate-50 text-brand-muted border-slate-200',
      };
  }
}

function JourneyHeader({
  title,
  subtitle,
  progress,
  embedded,
  showChip,
  vertical,
}: {
  title: string;
  subtitle?: string;
  progress: number;
  embedded?: boolean;
  showChip?: boolean;
  vertical?: boolean;
}) {
  return (
    <div
      className={
        vertical
          ? 'border-b border-[var(--los-panel-border)] bg-[rgba(248,250,255,0.85)] px-4 py-3'
          : `flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5 ${
              embedded
                ? 'border-t border-[var(--los-panel-border)] bg-[rgba(248,250,255,0.5)]'
                : 'border-b border-[var(--los-panel-border)] bg-[rgba(248,250,255,0.85)]'
            }`
      }
    >
      <div className="min-w-0">
        {showChip ? <span className="los-chip mb-1.5">Customer journey</span> : null}
        <h2 className="m-0 text-[0.92rem] font-extrabold tracking-[-0.02em] text-brand-navy md:text-[0.98rem]">{title}</h2>
        {subtitle ? <p className="m-0 mt-0.5 text-[0.75rem] text-brand-muted">{subtitle}</p> : null}
      </div>
      <div className={`flex items-center gap-2 shrink-0 ${vertical ? 'mt-3' : ''}`}>
        <div
          className={`overflow-hidden rounded-full bg-slate-200 ${vertical ? 'h-1.5 flex-1' : 'hidden h-1.5 w-20 sm:block'}`}
        >
          <div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[1.05rem] font-black tabular-nums leading-none text-brand-navy">{progress}%</span>
      </div>
    </div>
  );
}

function HorizontalJourneySteps({ steps }: { steps: JourneyStep[] }) {
  return (
    <div className="overflow-x-auto px-4 py-3 md:px-5">
      <ol className="m-0 flex min-w-[560px] list-none gap-0 p-0">
        {steps.map((item, index) => {
          const colors = stepColors(item.state);
          const isLast = index === steps.length - 1;
          return (
            <li key={item.id} className="relative flex min-w-0 flex-1 flex-col items-center px-1 text-center">
              {!isLast ? (
                <span
                  className={`pointer-events-none absolute left-[calc(50%+12px)] top-[11px] h-[2px] w-[calc(100%-24px)] ${colors.line}`}
                  aria-hidden
                />
              ) : null}
              <span
                className={`relative z-[1] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ${colors.dot}`}
                aria-hidden
              >
                {item.state === 'done' ? (
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} aria-hidden>
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : item.state === 'failed' ? (
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} aria-hidden>
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-white/90" />
                )}
              </span>
              <span className={`mt-2 block text-[0.68rem] font-extrabold uppercase tracking-[0.06em] ${colors.text}`}>
                {item.label}
              </span>
              {item.detail ? (
                <span className={`mt-1 inline-block max-w-[9rem] truncate rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold ${colors.badge}`}>
                  {item.detail}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function VerticalJourneySteps({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="m-0 list-none space-y-0 p-4">
      {steps.map((item, index) => {
        const colors = stepColors(item.state);
        const isLast = index === steps.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span
                className={`pointer-events-none absolute left-[11px] top-6 h-[calc(100%-8px)] w-[2px] ${colors.line}`}
                aria-hidden
              />
            ) : null}
            <span
              className={`relative z-[1] mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ${colors.dot}`}
              aria-hidden
            >
              {item.state === 'done' ? (
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} aria-hidden>
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : item.state === 'failed' ? (
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              ) : (
                <span className="h-2 w-2 rounded-full bg-white/90" />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <span className={`block text-[0.68rem] font-extrabold uppercase tracking-[0.06em] leading-snug ${colors.text}`}>
                {item.label}
              </span>
              {item.detail ? (
                <span className={`mt-1 inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold ${colors.badge}`}>
                  {item.detail}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function CustomerJourneyTimeline({
  title,
  subtitle,
  steps,
  embedded = false,
  orientation = 'horizontal',
}: {
  title: string;
  subtitle?: string;
  steps: JourneyStep[];
  embedded?: boolean;
  orientation?: 'horizontal' | 'vertical';
}) {
  const progress = journeyProgressPercent(steps);
  const isVertical = orientation === 'vertical';

  const content = (
    <>
      <JourneyHeader
        title={title}
        subtitle={subtitle}
        progress={progress}
        embedded={embedded}
        showChip={!embedded && !isVertical}
        vertical={isVertical}
      />
      {isVertical ? <VerticalJourneySteps steps={steps} /> : <HorizontalJourneySteps steps={steps} />}
    </>
  );

  if (embedded) return content;

  return (
    <section className={`los-card overflow-hidden ${isVertical ? 'sticky top-4 h-fit' : ''}`}>{content}</section>
  );
}

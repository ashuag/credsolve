'use client';

import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';
import { CountUp } from '@/components/ui/count-up';
import { RadialProgress } from '@/components/ui/radial-progress';

type Stat = {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** Gauge fill 0–100. */
  progress: number;
  label: string;
  desc: string;
  color: string;
  icon: React.ReactNode;
};

const STATS: Stat[] = [
  {
    to: 5000,
    suffix: '+',
    progress: 95,
    label: 'Happy Customers',
    desc: 'Across India trust us every month',
    color: '#4DB3FF',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.3 2.7-6 6-6" strokeLinecap="round" />
        <circle cx="16" cy="9" r="2.5" />
        <path d="M14 20c0-2.8 2.2-5 5-5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: 5,
    prefix: '₹',
    suffix: 'Cr+',
    progress: 90,
    label: 'Total Disbursed',
    desc: 'Loans disbursed to date',
    color: '#F4B400',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M7 9v6M17 9v6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: 2,
    suffix: ' Min',
    progress: 96,
    label: 'Approval Time',
    desc: 'Average loan sanction time',
    color: '#34d399',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9 2h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: 98,
    suffix: '%',
    progress: 98,
    label: 'Approval Rate',
    desc: 'First-time applicant success',
    color: '#f43f5e',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
        <path d="M5 13l4 4 10-11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: 4.9,
    suffix: '/5',
    decimals: 1,
    progress: 98,
    label: 'Customer Rating',
    desc: 'Average satisfaction score',
    color: '#a78bfa',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 3l2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 17.8 6.1 21.3l1.7-6.6L2.6 9.8l6.8-.5z" />
      </svg>
    ),
  },
];

export function StatsSection() {
  const sectionRef = useScrollReveal();

  return (
    <section ref={sectionRef} className="relative overflow-hidden stats-mesh py-20 lg:py-28">
      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      {/* Animated blobs */}
      <div className="pointer-events-none absolute top-0 right-0 h-96 w-96 rounded-full bg-[#1496f3]/10 blur-[100px] animate-blob" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#ffc519]/8 blur-[80px] animate-blob animation-delay-2000" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="reveal mb-5 inline-flex items-center gap-2.5 rounded-full bg-white/8 px-4 py-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-green-400" />
            <span className="text-[0.65rem] font-[900] uppercase tracking-[0.24em] text-white/55">
              Platform Performance
            </span>
          </div>
          <h2 className="reveal text-[clamp(2rem,4.5vw,3.2rem)] font-[900] tracking-tight text-white stagger-1">
            Numbers That{' '}
            <span className="text-grad-gold">Speak for Themselves.</span>
          </h2>
        </div>

        {/* Stats grid — radial gauge infographics */}
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-5">
          {STATS.map((s, idx) => (
            <div
              key={s.label}
              className={`reveal reveal-scale glass group flex flex-col items-center gap-4 rounded-[24px] p-5 text-center transition-all duration-300 hover:-translate-y-2 hover:bg-white/10 sm:p-6 stagger-${Math.min(idx + 1, 6)}`}
            >
              {/* Gauge */}
              <RadialProgress value={s.progress} color={s.color} duration={1600 + idx * 120}>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${s.color}22`, color: s.color }}
                >
                  {s.icon}
                </span>
                <span className="mt-1" style={{ color: s.color }}>
                  <CountUp
                    to={s.to}
                    prefix={s.prefix}
                    suffix={s.suffix}
                    decimals={s.decimals}
                    className="text-[1.35rem] font-[900] leading-none tabular-nums sm:text-[1.55rem]"
                  />
                </span>
              </RadialProgress>

              {/* Label */}
              <div className="flex flex-col gap-1">
                <div className="text-sm font-[800] text-white">{s.label}</div>
                <div className="text-[0.65rem] font-[600] leading-snug text-white/40">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="reveal mt-12 flex flex-wrap items-center justify-center gap-3 stagger-6">
          {[
            'Advance Fraud Detection',
            'DigiLocker Integrated',
            'Bank Verification',
            'Secure Data Privacy',
          ].map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[0.62rem] font-[800] uppercase tracking-[0.18em] text-white/55 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white/75"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden />
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

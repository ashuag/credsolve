'use client';

import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';
import { CountUp } from '@/components/ui/count-up';

const STATS = [
  {
    to: 50000,
    prefix: '',
    suffix: '+',
    label: 'Happy Customers',
    desc: 'Across India trust us every month',
    color: '#1496f3',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <circle cx="20" cy="20" r="20" fill="rgba(20,150,243,0.15)" />
        <circle cx="16" cy="15" r="4" stroke="#1496f3" strokeWidth="2" />
        <path d="M8 30c0-4.418 3.582-8 8-8" stroke="#1496f3" strokeWidth="2" strokeLinecap="round" />
        <circle cx="26" cy="15" r="4" stroke="#60c3ff" strokeWidth="2" />
        <path d="M24 22c4.418 0 8 3.582 8 8" stroke="#60c3ff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: 500,
    prefix: '₹',
    suffix: 'Cr+',
    label: 'Total Disbursed',
    desc: 'Loans disbursed to date',
    color: '#ffc519',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <circle cx="20" cy="20" r="20" fill="rgba(255,197,25,0.12)" />
        <circle cx="20" cy="20" r="10" stroke="#ffc519" strokeWidth="2" />
        <text x="20" y="25" textAnchor="middle" fontSize="12" fontWeight="900" fill="#ffc519" fontFamily="system-ui">₹</text>
      </svg>
    ),
  },
  {
    to: 2,
    prefix: '',
    suffix: ' Min',
    label: 'Approval Time',
    desc: 'Average loan sanction time',
    color: '#10b981',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <circle cx="20" cy="20" r="20" fill="rgba(16,185,129,0.12)" />
        <circle cx="20" cy="20" r="10" stroke="#10b981" strokeWidth="2" />
        <path d="M20 14v6l4 2.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: 98,
    prefix: '',
    suffix: '%',
    label: 'Approval Rate',
    desc: 'First-time applicant success',
    color: '#f43f5e',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <circle cx="20" cy="20" r="20" fill="rgba(244,63,94,0.12)" />
        <path d="M12 20l6 6 10-12" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: 49,
    prefix: '',
    suffix: ' Rating',
    label: '4.9 / 5 Stars',
    desc: 'Average customer satisfaction',
    color: '#8b5cf6',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10">
        <circle cx="20" cy="20" r="20" fill="rgba(139,92,246,0.12)" />
        <path d="M20 10l2.6 7.9H31l-6.7 4.9 2.6 7.9-6.9-5-6.9 5 2.6-7.9L9 17.9h8.4L20 10z" fill="#8b5cf6" />
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
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
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

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {STATS.map((s, idx) => (
            <div
              key={idx}
              className={`reveal reveal-scale glass group flex flex-col items-center gap-4 rounded-[28px] p-6 text-center transition-all duration-300 hover:-translate-y-2 hover:bg-white/10 stagger-${Math.min(idx + 1, 6)}`}
            >
              {/* Icon */}
              <div className="transition-transform duration-300 group-hover:scale-110">
                {s.icon}
              </div>

              {/* Counter */}
              <div className="text-[2.4rem] font-[900] leading-none text-white" style={{ color: s.color }}>
                <CountUp to={s.to} prefix={s.prefix} suffix={s.suffix} />
              </div>

              {/* Label */}
              <div className="flex flex-col gap-1">
                <div className="text-sm font-[800] text-white">{s.label}</div>
                <div className="text-[0.65rem] font-[600] leading-snug text-white/40">{s.desc}</div>
              </div>

              {/* Animated ring */}
              <div className="relative flex items-center justify-center">
                <div
                  className="h-1 w-1 rounded-full animate-ring-pop opacity-60"
                  style={{ backgroundColor: s.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges strip */}
        <div className="reveal mt-14 flex flex-wrap items-center justify-center gap-6 border-t border-white/8 pt-10 stagger-6">
          {[
            'ISO 27001 Certified',
            'DPDP Compliant',
            'DigiLocker Integrated',
            'Bank-Grade Security',
            '99.9% Uptime SLA',
          ].map((badge) => (
            <div
              key={badge}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[0.62rem] font-[700] uppercase tracking-[0.15em] text-white/40"
            >
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0 text-green-400" fill="currentColor">
                <circle cx="6" cy="6" r="6" />
              </svg>
              {badge}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

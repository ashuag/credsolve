'use client';

import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';

const FEATURES = [
  {
    title: 'Secure & Trusted',
    desc: 'RBI Registered NBFC with bank-grade 256-bit SSL encryption. Your data and money are always safe.',
    color: '#1496f3',
    lightBg: 'bg-[#eef7ff]',
    icon: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="56" height="56" rx="18" fill="rgba(20,150,243,0.1)" />
        <path d="M28 10L14 16v10c0 8.836 5.952 17.072 14 19 8.048-1.928 14-10.164 14-19V16L28 10z" stroke="#1496f3" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M22 28l4 4 8-8" stroke="#1496f3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    stats: [
      { label: 'Encryption', value: '256-bit' },
      { label: 'Platform', value: 'RBI Reg.' },
    ],
  },
  {
    title: 'Approval in Minutes',
    desc: 'AI-powered instant decisioning. From application to sanction letter in under 2 minutes.',
    color: '#ffc519',
    lightBg: 'bg-[#fffbeb]',
    icon: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="56" height="56" rx="18" fill="rgba(255,197,25,0.12)" />
        <circle cx="28" cy="28" r="13" stroke="#ffc519" strokeWidth="2.5" />
        <path d="M28 21v7l5 3" stroke="#ffc519" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 10l3 3M42 10l-3 3" stroke="#ffc519" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    stats: [
      { label: 'Approval', value: '2 Min' },
      { label: 'Disbursal', value: '10 Min' },
    ],
  },
  {
    title: 'Lowest Interest Rates',
    desc: 'Competitive interest rates starting from 12% p.a. with zero hidden fees or prepayment charges.',
    color: '#10b981',
    lightBg: 'bg-[#ecfdf5]',
    icon: (
      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="56" height="56" rx="18" fill="rgba(16,185,129,0.1)" />
        <circle cx="28" cy="28" r="13" stroke="#10b981" strokeWidth="2.5" />
        <text x="28" y="34" textAnchor="middle" fontSize="16" fontWeight="900" fill="#10b981" fontFamily="system-ui">₹</text>
        <path d="M22 22l12 12" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
        <circle cx="33" cy="22" r="2" fill="#10b981" />
        <circle cx="22" cy="33" r="2" fill="#10b981" />
      </svg>
    ),
    stats: [
      { label: 'Starting at', value: '12% p.a.' },
      { label: 'Hidden fees', value: 'Zero' },
    ],
  },
];

export function FeaturesSection() {
  const sectionRef = useScrollReveal();

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-white py-10 lg:py-14">
      {/* Gradient top edge from hero */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1496f3]/20 via-[#ffc519]/20 to-[#10b981]/20" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section label */}
        <div className="reveal mb-10 text-center">
          <p className="text-[0.65rem] font-[900] uppercase tracking-[0.28em] text-[#1496f3]/70">
            Why 50,000+ Indians Choose MoneyCash
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f, idx) => (
            <div
              key={idx}
              className={`reveal reveal-scale group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-[rgba(18,36,79,0.06)] p-6 transition-all duration-400 hover:-translate-y-2 hover:shadow-[0_28px_60px_rgba(18,36,79,0.1)] stagger-${idx + 1} ${f.lightBg}`}
            >
              {/* Icon */}
              <div className="w-14 h-14 transition-transform duration-400 group-hover:scale-110 group-hover:rotate-3">
                {f.icon}
              </div>

              {/* Content */}
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-[900] tracking-tight text-[#12244f]">{f.title}</h3>
                <p className="text-sm font-[600] leading-relaxed text-[#12244f]/55">{f.desc}</p>
              </div>

              {/* Stats chips */}
              <div className="flex gap-3">
                {f.stats.map((s, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-0.5 rounded-xl bg-white/70 px-4 py-2.5 shadow-sm"
                  >
                    <span className="text-[0.58rem] font-[800] uppercase tracking-[0.16em] text-[#12244f]/40">{s.label}</span>
                    <span className="text-base font-[900]" style={{ color: f.color }}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Decorative corner glow */}
              <div
                className="pointer-events-none absolute -bottom-12 -right-12 h-36 w-36 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ backgroundColor: f.color }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

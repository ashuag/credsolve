'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { buildHrefWithSearch } from '@/lib/navigation';
import { useEffect, useRef, useState } from 'react';

function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 1800,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !ran.current) {
          ran.current = true;
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min((t - t0) / duration, 1);
            setVal(Math.round((1 - (1 - p) ** 3) * to));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{val.toLocaleString('en-IN')}{suffix}
    </span>
  );
}

export function HeroSection() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);

  return (
    <section className="relative overflow-hidden hero-mesh">
      {/* Grid mesh overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* Animated blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -right-32 h-[600px] w-[600px] rounded-full bg-[#1496f3]/12 blur-[120px] animate-blob"
          style={{ animationDuration: '7s' }}
        />
        <div
          className="absolute -bottom-24 -left-24 h-[500px] w-[500px] rounded-full bg-[#ffc519]/8 blur-[100px] animate-blob animation-delay-2000"
          style={{ animationDuration: '9s' }}
        />
        <div
          className="absolute top-1/2 left-1/3 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-[#1c347d]/18 blur-[80px] animate-blob animation-delay-4000"
          style={{ animationDuration: '11s' }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-h-[90vh] items-center gap-12 py-16 lg:grid-cols-2 lg:gap-20 lg:py-0">

          {/* ── Left: Content ── */}
          <div className="flex flex-col gap-8">
            {/* Live badge */}
            <div className="flex items-center gap-3 animate-fade-in-up">
              <div className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
              </div>
              <span className="text-[0.7rem] font-[900] uppercase tracking-[0.22em] text-white/55">
                RBI Registered NBFC &bull; Trusted by 50,000+ Customers
              </span>
            </div>

            {/* Headline */}
            <div className="animate-fade-in-up flex flex-col gap-4" style={{ animationDelay: '80ms' }}>
              <h1 className="text-[clamp(2.6rem,5.5vw,4.2rem)] font-[900] leading-[1.08] tracking-tight text-white">
                Fast Loans up to{' '}
                <span className="text-grad-gold">₹50,000</span>
                <br />
                <span className="text-white/90">Direct to Your Bank.</span>
              </h1>
              <p className="max-w-lg text-lg font-medium leading-relaxed text-white/50">
                100% digital &bull; zero paperwork &bull; instant disbursal.
                Get approved in <span className="font-[800] text-white/80">2 minutes</span> and money in your account in{' '}
                <span className="font-[800] text-white/80">10 minutes</span>.
              </p>
            </div>

            {/* Trust chips */}
            <div className="flex animate-fade-in-up flex-wrap gap-2" style={{ animationDelay: '160ms' }}>
              {[
                { icon: (
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-green-400" fill="currentColor">
                    <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                  </svg>
                ), label: 'No Hidden Charges' },
                { icon: (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[#ffc519]" fill="currentColor">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                ), label: 'Instant Approval' },
                { icon: (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[#1496f3]" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="5" y="11" width="14" height="11" rx="2" strokeLinecap="round"/>
                    <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round"/>
                  </svg>
                ), label: 'PAN & Aadhaar Only' },
              ].map((chip) => (
                <div
                  key={chip.label}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-[700] text-white/65 glass"
                >
                  {chip.icon}
                  {chip.label}
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div
              className="flex animate-fade-in-up flex-col gap-4 sm:flex-row sm:items-center"
              style={{ animationDelay: '240ms' }}
            >
              <Link
                href={applyHref}
                className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[#ffc519] px-10 py-5 text-[1.05rem] font-[900] text-[#0a1628] glow-gold"
              >
                Apply Now — It&apos;s Free
                <svg viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" fill="currentColor">
                  <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
                </svg>
                {/* Sheen effect */}
                <span className="absolute inset-0 overflow-hidden rounded-2xl">
                  <span className="absolute -left-full top-0 h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-sheen" />
                </span>
              </Link>

              <Link
                href={applyHref}
                className="inline-flex items-center gap-2.5 rounded-2xl border border-white/14 bg-white/5 px-8 py-5 text-base font-[700] text-white/75 backdrop-blur-sm transition-all hover:border-white/28 hover:bg-white/10"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Check My Eligibility
              </Link>
            </div>

            {/* Animated stats */}
            <div
              className="animate-fade-in-up flex flex-wrap gap-x-10 gap-y-5 border-t border-white/8 pt-8"
              style={{ animationDelay: '320ms' }}
            >
              {[
                { label: 'Happy Customers', to: 50000, prefix: '', suffix: '+' },
                { label: 'Total Disbursed', to: 500, prefix: '₹', suffix: 'Cr+' },
                { label: 'Approval Time', to: 2, prefix: '', suffix: ' Min' },
                { label: 'Approval Rate', to: 98, prefix: '', suffix: '%' },
              ].map((s, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="text-[1.9rem] font-[900] tabular-nums text-white">
                    <CountUp to={s.to} prefix={s.prefix} suffix={s.suffix} />
                  </div>
                  <div className="text-[0.65rem] font-[800] uppercase tracking-[0.2em] text-white/30">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Illustration ── */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative" style={{ width: 'min(300px, 80vw)' }}>

              {/* Phone SVG */}
              <svg
                viewBox="0 0 300 580"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full animate-float drop-shadow-[0_60px_120px_rgba(20,150,243,0.25)]"
                style={{ animationDuration: '5s' }}
              >
                <defs>
                  <linearGradient id="phoneGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#172c71" />
                    <stop offset="100%" stopColor="#0c1a4a" />
                  </linearGradient>
                  <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1496f3" />
                    <stop offset="100%" stopColor="#ffc519" />
                  </linearGradient>
                  <linearGradient id="btnGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffd040" />
                    <stop offset="100%" stopColor="#ffb800" />
                  </linearGradient>
                  <filter id="phoneGlow">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Phone body */}
                <rect x="6" y="6" width="288" height="568" rx="44" fill="url(#phoneGrad)" />
                <rect x="6" y="6" width="288" height="568" rx="44" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none" />
                {/* Screen */}
                <rect x="14" y="14" width="272" height="552" rx="38" fill="#080f22" />
                {/* Side buttons */}
                <rect x="0" y="120" width="5" height="50" rx="2.5" fill="#1c2d6e" />
                <rect x="295" y="100" width="5" height="70" rx="2.5" fill="#1c2d6e" />

                {/* Status bar */}
                <text x="34" y="48" fontSize="11" fill="rgba(255,255,255,0.6)" fontFamily="system-ui, sans-serif" fontWeight="600">9:41</text>
                <rect x="228" y="38" width="32" height="14" rx="3.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" />
                <rect x="229.5" y="39.5" width="24" height="11" rx="2.5" fill="rgba(255,255,255,0.55)" />
                <rect x="260" y="42" width="2.5" height="8" rx="1.25" fill="rgba(255,255,255,0.4)" />
                {/* Wifi dots */}
                <circle cx="218" cy="45" r="2" fill="rgba(255,255,255,0.4)" />
                <circle cx="210" cy="45" r="2" fill="rgba(255,255,255,0.25)" />
                <circle cx="202" cy="45" r="2" fill="rgba(255,255,255,0.15)" />

                {/* Notch */}
                <rect x="108" y="14" width="84" height="28" rx="14" fill="#080f22" />
                <circle cx="168" cy="28" r="5" fill="#1c1c3c" />
                <circle cx="168" cy="28" r="2" fill="#2a2a50" />

                {/* App header */}
                <rect x="14" y="58" width="272" height="58" fill="#0e1d4a" />
                <circle cx="44" cy="87" r="14" fill="rgba(255,255,255,0.06)" />
                <path d="M38 87 h12 M44 81 v12" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" />
                <text x="150" y="92" textAnchor="middle" fontSize="15" fontWeight="800" fill="white" fontFamily="system-ui, sans-serif">MoneyCash</text>
                {/* Notification dot */}
                <circle cx="256" cy="78" r="10" fill="rgba(255,255,255,0.06)" />
                <path d="M252 79 h8 M252 82 h8" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="259" cy="75" r="3" fill="#f43f5e" />

                {/* Main loan card */}
                <rect x="24" y="130" width="252" height="242" rx="26" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                <rect x="24" y="130" width="252" height="4" rx="2" fill="url(#progressGrad)" opacity="0.6" />

                {/* Loan amount section */}
                <text x="150" y="175" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.38)" fontFamily="system-ui, sans-serif" fontWeight="700" letterSpacing="2">LOAN AMOUNT</text>
                <text x="150" y="222" textAnchor="middle" fontSize="42" fontWeight="900" fill="#ffc519" fontFamily="system-ui, sans-serif">₹50,000</text>

                {/* Approved badge */}
                <rect x="76" y="238" width="148" height="38" rx="19" fill="rgba(16,185,129,0.14)" stroke="rgba(16,185,129,0.28)" strokeWidth="1" />
                <circle cx="99" cy="257" r="10" fill="#10b981" />
                <path d="M95 257 l3 3 l6-6" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <text x="165" y="261.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#10b981" fontFamily="system-ui, sans-serif" letterSpacing="0.5">APPROVED!</text>

                {/* Disbursal info */}
                <text x="150" y="304" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.32)" fontFamily="system-ui, sans-serif">Money in bank within</text>
                <text x="150" y="328" textAnchor="middle" fontSize="22" fontWeight="900" fill="white" fontFamily="system-ui, sans-serif">10 Minutes</text>

                {/* Progress bar */}
                <rect x="44" y="344" width="212" height="5" rx="2.5" fill="rgba(255,255,255,0.08)" />
                <rect x="44" y="344" width="190" height="5" rx="2.5" fill="url(#progressGrad)" />
                <circle cx="234" cy="346.5" r="6" fill="white" />
                <circle cx="234" cy="346.5" r="3" fill="#ffc519" />

                {/* Collect button */}
                <rect x="44" y="392" width="212" height="52" rx="26" fill="url(#btnGrad)" />
                <text x="150" y="423" textAnchor="middle" fontSize="15" fontWeight="900" fill="#0a1628" fontFamily="system-ui, sans-serif">Collect Now  →</text>

                {/* Bottom nav */}
                <rect x="14" y="460" width="272" height="106" rx="0" fill="rgba(14,29,74,0.7)" />
                <line x1="14" y1="460" x2="286" y2="460" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

                {/* Nav icons */}
                <circle cx="68" cy="496" r="18" fill="rgba(255,255,255,0.05)" />
                <path d="M61 496 h14 M68 489 v14" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8" strokeLinecap="round" />
                <text x="68" y="522" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.2)" fontFamily="system-ui">Home</text>

                <circle cx="150" cy="496" r="18" fill="rgba(20,150,243,0.25)" />
                <path d="M146 492 h8 M146 496 h8 M146 500 h8" stroke="#1496f3" strokeWidth="1.8" strokeLinecap="round" />
                <text x="150" y="522" textAnchor="middle" fontSize="8" fill="#1496f3" fontFamily="system-ui">Loans</text>

                <circle cx="232" cy="496" r="18" fill="rgba(255,255,255,0.05)" />
                <circle cx="232" cy="490" r="6" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" fill="none" />
                <path d="M222 502 q10-6 20 0" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" fill="none" />
                <text x="232" y="522" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.2)" fontFamily="system-ui">Account</text>

                {/* Home indicator */}
                <rect x="118" y="550" width="64" height="5" rx="2.5" fill="rgba(255,255,255,0.25)" />
              </svg>

              {/* Floating badge: ₹50K Credited */}
              <div
                className="absolute -top-6 -right-4 sm:-right-10 animate-float-alt glass rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-500/20">
                    <svg viewBox="0 0 20 20" className="h-5 w-5 text-green-400" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[0.58rem] font-[900] uppercase tracking-[0.15em] text-white/40">Credited</div>
                    <div className="text-base font-[900] text-white">₹50,000</div>
                  </div>
                </div>
              </div>

              {/* Floating badge: Speed */}
              <div
                className="absolute -bottom-4 -left-4 sm:-left-10 animate-float glass rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                style={{ animationDelay: '2s' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffc519]/15">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#ffc519]" fill="currentColor">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[0.58rem] font-[900] uppercase tracking-[0.15em] text-white/40">Approved in</div>
                    <div className="text-base font-[900] text-[#ffc519]">47 Seconds</div>
                  </div>
                </div>
              </div>

              {/* Floating badge: Security (desktop only) */}
              <div
                className="absolute top-[38%] -right-4 hidden animate-float-slow xl:block glass rounded-2xl px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                style={{ animationDelay: '1s' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1496f3]/20">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#1496f3]" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[0.58rem] font-[900] uppercase tracking-[0.12em] text-white/38">Security</div>
                    <div className="text-sm font-[900] text-white">256-bit SSL</div>
                  </div>
                </div>
              </div>

              {/* Glow behind phone */}
              <div className="pointer-events-none absolute inset-0 -z-10 scale-75 rounded-full bg-[#1496f3]/20 blur-[80px]" />
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="border-t border-white/6 py-5">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
            {[
              { label: 'RBI Registered NBFC', path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
              { label: 'Bank-Grade Security', path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
              { label: '256-bit Encryption', path: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
              { label: 'Trusted by 50,000+', path: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 text-white/35">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d={item.path} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[0.68rem] font-[700] uppercase tracking-[0.14em]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

import {useCallback, useEffect, useRef, useState, type TouchEvent} from 'react';
import {useScrollReveal} from '@/lib/hooks/use-scroll-reveal';

const REVIEWS = [
  {
    name: 'Suresh Pillai',
    city: 'Chennai, TN',
    initials: 'SP',
    avatarColor: '#f59e0b',
    rating: 5,
    title: 'What they showed is what I paid',
    body: "I'm very careful with loan apps because a colleague of mine got burnt with hidden charges on another app. So I checked the calculator here 2-3 times before applying. Took ₹30,000 for house shifting, closed it in 45 days - final amount was exactly what they showed in the beginning. Nothing extra got cut. That's all I wanted really.",
    loan: 'Short Personal — ₹30,000',
    loanColor: '#10b981',
    date: 'February 2026',
    verified: true,
  },
  {
    name: 'Anita Krishnan',
    city: 'Bengaluru, KA',
    initials: 'AK',
    avatarColor: '#8b5cf6',
    rating: 5,
    title: "Paid my daughter's school fees the same day",
    body: 'Fees deadline was close and salary was still 2 weeks away. Applied around 9-9.30 in the morning and the money came before lunch itself. Paid the school the same afternoon. They showed all the charges before I clicked accept, and when I repaid, it was the same amount - nothing added later.',
    loan: 'Education Fee — ₹30,000',
    loanColor: '#8b5cf6',
    date: 'January 2026',
    verified: true,
  },
  {
    name: 'Priya Sharma',
    city: 'Mumbai, MH',
    initials: 'PS',
    avatarColor: '#1496f3',
    rating: 5,
    title: 'Money came while I was sitting in the hospital',
    body: "Mom was admitted suddenly and I didn't want to call relatives for money at 11 in the night. Applied from the hospital corridor itself — OTP, PAN, done. Money came in maybe 8-10 minutes. Great experience.",
    loan: 'Payday Advance — ₹25,000',
    loanColor: '#10b981',
    date: 'March 2026',
    verified: true,
  },
  {
    name: 'Rajan Mehta',
    city: 'Ahmedabad, GJ',
    initials: 'RM',
    avatarColor: '#ffc519',
    rating: 5,
    title: 'Got 8k for bike repair in minutes',
    body: 'Bike clutch plate gave up suddenly and the mechanic wanted 7-8k on the spot. Who gives such small loans quickly? Tried MoneyCash - PAN and Aadhaar verification hardly took 3-4 minutes. Repaid after 20 days when salary came.',
    loan: 'Emergency Fund — ₹8,000',
    loanColor: '#1496f3',
    date: 'February 2026',
    verified: true,
  },
  {
    name: 'Vikram Nair',
    city: 'Pune, MH',
    initials: 'VN',
    avatarColor: '#f43f5e',
    rating: 5,
    title: 'Medical emergency handled stress-free',
    body: 'My father was hospitalised suddenly and I needed ₹30,000 immediately. The medical emergency loan was approved instantly, zero processing fee, and the money was in my account before I even reached the hospital.',
    loan: 'Medical Emergency — ₹30,000',
    loanColor: '#f43f5e',
    date: 'March 2026',
    verified: true,
  },
  {
    name: 'Deepika Agarwal',
    city: 'Delhi, DL',
    initials: 'DA',
    avatarColor: '#10b981',
    rating: 5,
    title: 'Payday advance saved me this month',
    body: 'Salary was delayed by 2 weeks and I needed ₹15,000 for rent. The payday advance was disbursed in 9 minutes. Auto-debit repayment on salary day made it totally hassle-free. Highly recommend!',
    loan: 'Payday Advance — ₹15,000',
    loanColor: '#f59e0b',
    date: 'April 2026',
    verified: true,
  },
];

function StarRating({count}: {count: number}) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {Array.from({length: 5}).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 ${i < count ? 'text-[#ffc519]' : 'text-[#12244f]/10'}`}
          fill="currentColor"
        >
          <path d="M8 1l1.854 3.756 4.146.602-3 2.924.708 4.128L8 10.41l-3.708 2L5 8.282 2 5.358l4.146-.602L8 1z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({r}: {r: (typeof REVIEWS)[number]}) {
  return (
    <article className="relative flex h-full flex-col gap-5 rounded-[28px] border border-white/60 bg-white/80 backdrop-blur-md p-6 shadow-[0_12px_40px_rgba(18,36,79,0.03)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_24px_60px_rgba(18,36,79,0.1)]">
      {/* Big decorative quote mark */}
      <div className="absolute right-5 top-4 select-none text-5xl font-[900] leading-none text-[#12244f]/5">&ldquo;</div>

      <div className="flex items-center justify-between">
        <StarRating count={r.rating} />
        {r.verified && (
          <div className="flex items-center gap-1.5 rounded-full bg-[#10b981]/8 px-2.5 py-1 text-[0.58rem] font-[800] uppercase tracking-[0.14em] text-[#059669] border border-[#10b981]/15">
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden>
              <path d="M10.07 3.47a.75.75 0 00-1.07 0L5 7.47l-1.96-2a.75.75 0 10-1.08 1.06l2.5 2.5a.75.75 0 001.08 0l4.53-4.5a.75.75 0 000-1.06z" />
            </svg>
            Verified
          </div>
        )}
      </div>

      <h3 className="text-[0.95rem] font-[800] text-[#12244f] leading-snug">&ldquo;{r.title}&rdquo;</h3>
      <p className="text-[0.82rem] font-[500] leading-relaxed text-[#12244f]/60 flex-1">{r.body}</p>

      <div
        className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.6rem] font-[800] uppercase tracking-[0.12em]"
        style={{
          borderColor: `${r.loanColor}25`,
          color: r.loanColor,
          backgroundColor: `${r.loanColor}12`
        }}
      >
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden>
          <path d="M6 1l1.236 3.8h4l-3.236 2.35 1.236 3.8L6 8.6l-3.236 2.35 1.236-3.8L.764 4.8h4z" />
        </svg>
        {r.loan}
      </div>

      <div className="mt-auto h-px bg-[rgba(18,36,79,0.06)]" />

      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-[900] text-white shadow-sm"
          style={{backgroundColor: r.avatarColor}}
        >
          {r.initials}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-[800] text-[#12244f]">{r.name}</span>
          <span className="text-[0.62rem] font-[600] text-[#12244f]/50">
            {r.city} · {r.date}
          </span>
        </div>
      </div>
    </article>
  );
}

const AUTO_MS = 6500;

export function TestimonialsSection() {
  const sectionRef = useScrollReveal();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const len = REVIEWS.length;

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + len) % len);
    },
    [len],
  );

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % len);
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, [paused, len]);

  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const dx = e.changedTouches[0].clientX - start;
    if (dx > 56) go(-1);
    else if (dx < -56) go(1);
  };

  // Show 3 reviews at a time on desktop (centered on `index`)
  const visibleIndices = [
    (index - 1 + len) % len,
    index,
    (index + 1) % len,
  ];

  return (
    <section
      id="testimonials"
      ref={sectionRef}
      className="relative overflow-hidden bg-transparent py-20 lg:py-28"
      aria-labelledby="testimonials-heading"
    >
      {/* Backgrounds */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.018]"
        style={{backgroundImage: 'radial-gradient(#12244f 1px, transparent 1px)', backgroundSize: '32px 32px'}}
        aria-hidden
      />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#1496f3]/8 blur-[100px]" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[#ffc519]/6 blur-[80px]" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-12 text-center lg:mb-14">
          <div className="reveal mb-5 inline-flex items-center gap-2.5 rounded-full bg-[#f59e0b]/8 px-5 py-2.5 border border-[#f59e0b]/15 shadow-sm">
            <span className="text-[0.65rem] font-[900] uppercase tracking-[0.24em] text-[#e5a800]">Real customers, real stories</span>
          </div>
          <h2 id="testimonials-heading" className="reveal text-[clamp(2rem,4.5vw,3.2rem)] font-[900] tracking-tight text-[#12244f] stagger-1">
            Loved by Borrowers{' '}
            <span className="bg-gradient-to-r from-[#1496f3] to-brand-navy bg-clip-text text-transparent">Across India</span>
          </h2>
          <div className="reveal mt-5 flex items-center justify-center gap-3 stagger-2">
            <StarRating count={5} />
            <span className="text-sm font-[800] text-[#12244f]">4.9 / 5</span>
            <span className="text-sm font-[600] text-[#12244f]/60">from 300+ reviews</span>
          </div>
        </div>

        {/* Desktop: 3-column grid */}
        <div
          className="reveal hidden lg:grid lg:grid-cols-3 lg:gap-5 stagger-3"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {visibleIndices.map((reviewIdx, colIdx) => (
            <div
              key={`${reviewIdx}-${colIdx}`}
              className={`animate-fade-in-up transition-all duration-500 ${colIdx === 1 ? 'scale-[1.03] shadow-[0_24px_64px_rgba(18,36,79,0.1)]' : 'opacity-75 scale-[0.97]'}`}
              style={{animationDelay: `${colIdx * 60}ms`}}
            >
              <TestimonialCard r={REVIEWS[reviewIdx]} />
            </div>
          ))}
        </div>

        {/* Mobile: single carousel */}
        <div
          className="reveal lg:hidden mx-auto max-w-2xl stagger-3"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false);
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="relative overflow-hidden rounded-[24px]"
            role="region"
            aria-roledescription="carousel"
            aria-label="Customer testimonials"
          >
            <div className="animate-fade-in-up" key={index} aria-live="polite">
              <TestimonialCard r={REVIEWS[index]} />
            </div>
          </div>
        </div>

        {/* Pagination & navigation — shared */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => go(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#12244f]/10 bg-white/80 backdrop-blur-sm text-[#12244f] shadow-sm transition hover:border-[#1496f3]/30 hover:bg-white hover:shadow-md hover:text-[#1496f3]"
            aria-label="Previous testimonial"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            {REVIEWS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === index ? 'w-8 bg-[#1496f3]' : 'w-2 bg-[#12244f]/15 hover:bg-[#12244f]/30'
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#12244f]/10 bg-white/80 backdrop-blur-sm text-[#12244f] shadow-sm transition hover:border-[#1496f3]/30 hover:bg-white hover:shadow-md hover:text-[#1496f3]"
            aria-label="Next testimonial"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="reveal mt-10 text-center stagger-6">
          <p className="text-sm font-[600] text-[#12244f]/50">
            Join 5,000+ happy customers.{' '}
            <span className="font-[800] text-[#1496f3]">Start your loan journey today →</span>
          </p>
        </div>
      </div>
    </section>
  );
}

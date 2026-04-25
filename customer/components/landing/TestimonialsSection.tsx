'use client';

import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';

const REVIEWS = [
  {
    name: 'Priya Sharma',
    city: 'Mumbai, MH',
    initials: 'PS',
    avatarColor: '#1496f3',
    rating: 5,
    title: 'Got ₹25,000 in literally 8 minutes!',
    body: 'I needed money urgently for my mom\'s medical expenses. MoneyCash approved my salary advance loan in under 2 minutes and the money hit my account in 8 minutes. No branch visit, no paperwork. Absolute lifesaver!',
    loan: 'Salary Boost — ₹25,000',
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
    title: 'Best app for quick micro loans',
    body: 'Used the Micro Emergency loan for ₹8,000 when my bike broke down. The Aadhaar-only verification took 3 minutes and I got the cash instantly. Repaid in 20 days with a flat fee — no surprises at all.',
    loan: 'Micro Emergency — ₹8,000',
    loanColor: '#1496f3',
    date: 'February 2026',
    verified: true,
  },
  {
    name: 'Anita Krishnan',
    city: 'Bengaluru, KA',
    initials: 'AK',
    avatarColor: '#8b5cf6',
    rating: 5,
    title: 'Education fee loan sorted in same day',
    body: 'My daughter\'s school fees were due and I was short by ₹40,000. Applied on MoneyCash at 9 AM and had the money before lunch. Paying it back in 6 easy EMIs at just 12% — the lowest rate I found anywhere.',
    loan: 'Education Fee — ₹40,000',
    loanColor: '#8b5cf6',
    date: 'January 2026',
    verified: true,
  },
  {
    name: 'Vikram Nair',
    city: 'Pune, MH',
    initials: 'VN',
    avatarColor: '#f43f5e',
    rating: 5,
    title: 'Medical emergency handled stress-free',
    body: 'My father was hospitalised suddenly and I needed ₹50,000 immediately. The medical emergency loan was approved instantly, zero processing fee, and the money was in my account before I even reached the hospital.',
    loan: 'Medical Emergency — ₹50,000',
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
  {
    name: 'Suresh Pillai',
    city: 'Chennai, TN',
    initials: 'SP',
    avatarColor: '#f59e0b',
    rating: 5,
    title: 'Super transparent — what you see is what you pay',
    body: 'Tried 3 other apps before MoneyCash and all had hidden charges. Here the calculator showed exactly what I\'d pay and that\'s exactly what I paid. Got ₹30,000 personal loan at 18% with EMIs over 6 months.',
    loan: 'Short Personal — ₹30,000',
    loanColor: '#10b981',
    date: 'February 2026',
    verified: true,
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${i < count ? 'text-[#ffc519]' : 'text-[#12244f]/10'}`} fill="currentColor">
          <path d="M8 1l1.854 3.756 4.146.602-3 2.924.708 4.128L8 10.41l-3.708 2L5 8.282 2 5.358l4.146-.602L8 1z" />
        </svg>
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  const sectionRef = useScrollReveal();

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-white py-20 lg:py-28">
      {/* Background decoration */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{ backgroundImage: 'radial-gradient(#12244f 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#1496f3]/8 blur-[80px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 text-center">
          <div className="reveal mb-5 inline-flex items-center gap-2.5 rounded-full bg-[#ffc519]/10 px-4 py-2">
            <span className="text-[0.65rem] font-[900] uppercase tracking-[0.24em] text-[#f59e0b]">
              Real Customers, Real Stories
            </span>
          </div>
          <h2 className="reveal text-[clamp(2rem,4.5vw,3.2rem)] font-[900] tracking-tight text-[#12244f] stagger-1">
            Loved by Borrowers{' '}
            <span className="bg-[linear-gradient(135deg,#1496f3,#1c347d)] bg-clip-text text-transparent">
              Across India.
            </span>
          </h2>
          <div className="reveal mt-5 flex items-center justify-center gap-3 stagger-2">
            <StarRating count={5} />
            <span className="text-sm font-[800] text-[#12244f]">4.9 / 5</span>
            <span className="text-sm font-[600] text-[#12244f]/40">from 12,400+ reviews</span>
          </div>
        </div>

        {/* Reviews grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {REVIEWS.map((r, idx) => (
            <div
              key={idx}
              className={`reveal reveal-scale group relative flex flex-col gap-5 rounded-[28px] border border-[rgba(18,36,79,0.06)] bg-[#f8faff] p-7 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_24px_60px_rgba(18,36,79,0.1)] stagger-${Math.min((idx % 3) + 1, 6)}`}
            >
              {/* Quote mark */}
              <div className="absolute right-6 top-5 text-5xl font-[900] leading-none text-[#12244f]/5 select-none">&ldquo;</div>

              {/* Stars + Verified */}
              <div className="flex items-center justify-between">
                <StarRating count={r.rating} />
                {r.verified && (
                  <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[0.6rem] font-[800] uppercase tracking-[0.14em] text-green-600">
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
                      <path d="M10.07 3.47a.75.75 0 00-1.07 0L5 7.47l-1.96-2a.75.75 0 10-1.08 1.06l2.5 2.5a.75.75 0 001.08 0l4.53-4.5a.75.75 0 000-1.06z" />
                    </svg>
                    Verified
                  </div>
                )}
              </div>

              {/* Review title */}
              <h4 className="text-base font-[800] text-[#12244f]">&ldquo;{r.title}&rdquo;</h4>

              {/* Body */}
              <p className="text-sm font-[500] leading-relaxed text-[#12244f]/55">{r.body}</p>

              {/* Loan tag */}
              <div
                className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.62rem] font-[800] uppercase tracking-[0.12em] text-white"
                style={{ backgroundColor: r.loanColor }}
              >
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
                  <path d="M6 1l1.236 3.8h4l-3.236 2.35 1.236 3.8L6 8.6l-3.236 2.35 1.236-3.8L.764 4.8h4z" />
                </svg>
                {r.loan}
              </div>

              {/* Divider */}
              <div className="h-px bg-[rgba(18,36,79,0.06)]" />

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-[900] text-white shadow-sm"
                  style={{ backgroundColor: r.avatarColor }}
                >
                  {r.initials}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-[800] text-[#12244f]">{r.name}</span>
                  <span className="text-[0.65rem] font-[600] text-[#12244f]/40">{r.city} · {r.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View more */}
        <div className="reveal mt-10 text-center stagger-6">
          <p className="text-sm font-[600] text-[#12244f]/40">
            Join 50,000+ happy customers.{' '}
            <span className="font-[800] text-[#1496f3]">Start your loan journey today →</span>
          </p>
        </div>
      </div>
    </section>
  );
}

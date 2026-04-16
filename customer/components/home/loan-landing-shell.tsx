import type {ReactNode} from 'react';
import Image from 'next/image';
import Link from 'next/link';

type HighlightIconKind = 'shield' | 'flash' | 'path';

const demoInviteToken = process.env.CUSTOMER_DEMO_INVITE_TOKEN?.trim();
const demoInviteHref = demoInviteToken ? `/invite/${encodeURIComponent(demoInviteToken)}` : null;

const BENEFITS_BAR = [
    {
        label: '100% Digital',
        sub: 'journey',
        icon: (
            <svg viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="5" y="2" width="12" height="18" rx="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="11" cy="16.5" r="1" fill="currentColor" stroke="none"/>
            </svg>
        ),
    },
    {
        label: 'No hidden',
        sub: 'charges',
        icon: (
            <svg viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M11 2a6 6 0 0 1 0 12M11 2a6 6 0 0 0 0 12M11 14v6M8 20h6" strokeLinecap="round"
                      strokeLinejoin="round"/>
            </svg>
        ),
    },
    {
        label: 'Zero',
        sub: 'foreclosure',
        icon: (
            <svg viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M11 3l6 2.7v4.5c0 3.7-2.3 6.6-6 8-3.7-1.4-6-4.3-6-8V5.7L11 3z" strokeLinecap="round"
                      strokeLinejoin="round"/>
                <path d="M8.5 11l1.7 1.7 3.3-3.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        ),
    },
] as const;

const OFFERINGS = [
    {
        label: 'Instant Cash',
        sub: 'Short-term loan',
        icon: (
            <svg viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2" y="6" width="18" height="12" rx="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 6V5a3 3 0 0 1 6 0v1M16 12h.01" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        ),
    },
    {
        label: 'Flexi Repay',
        sub: 'Choose EMI date',
        icon: (
            <svg viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 11h18M3 6h18M3 16h10" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        ),
    },
    {
        label: 'Top-up',
        sub: 'Extra funds',
        icon: (
            <svg viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 19V5M5 12l6-6 6 6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        ),
    },
    {
        label: 'EMI Calculator',
        sub: 'Plan your repayment',
        icon: (
            <svg viewBox="0 0 22 22" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="3" width="16" height="16" rx="3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 7h8M7 11h4M7 15h2M13 15l2-2 2 2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        ),
    },
] as const;

const CONTENT_COLUMNS = [
    {
        id: 'offers',
        title: 'Offers',
        items: [
            {label: 'Zero processing fee - limited time', badge: 'New'},
            {label: 'Refer & earn Rs200 per successful referral', badge: 'Hot'},
        ],
    },
    {
        id: 'learn',
        title: 'Learn',
        items: [
            {label: 'What is a short-term personal loan?', badge: null},
            {label: 'How is my loan eligibility calculated?', badge: null},
        ],
    },
] as const;

const highlights = [
    {
        title: 'Seamless Digital Verification',
        description: 'OTP & KYC-based verification for quick loan processing.',
        icon: 'shield' as const,
    },
    {
        title: 'Instant Credit Decisions',
        description: 'Advanced underwriting enables quick approvals for short-term loans — typically within minutes.',
        icon: 'flash' as const,
    },
    {
        title: 'Transparent & Guided Journey',
        description: 'A clear, step-by-step process with full visibility from eligibility to approval and disbursal — no hidden terms.',
        icon: 'path' as const,
    },
];

const steps = ['Onboarding', 'Customer details', 'Loan Details', 'Disbursement'];

function HighlightIcon({kind}: { kind: HighlightIconKind }) {
    if (kind === 'shield') {
        return (
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3l7 3.2v5.3c0 4.4-2.7 7.8-7 9.5-4.3-1.7-7-5.1-7-9.5V6.2L12 3z" strokeLinecap="round"
                      strokeLinejoin="round"/>
                <path d="M9.3 12.2l1.9 1.9 3.8-4.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    }
    if (kind === 'flash') {
        return (
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13.2 2.8L6.7 13h4l-.8 8.2L17.3 11h-4.1V2.8z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18c0-2.8 2.2-5 5-5h2c2.2 0 4-1.8 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="6" cy="18" r="1.8" fill="currentColor" stroke="none"/>
            <circle cx="17" cy="9" r="1.8" fill="currentColor" stroke="none"/>
            <path d="M17 4.8V9h-4.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );
}

function LandingHeroPanel() {
    return (
        <div className="mc-card mc-card-glow">
            <div className="mc-chip">Short-term loan journey</div>
            <h1 className="my-3.5 mb-3 text-brand-navy text-[clamp(2.6rem,8vw,3rem)] leading-[0.94] tracking-[-0.06em] max-sm:text-[clamp(2.3rem,11vw,2.7rem)]">
                Get Instant Loan up to ₹50,000
            </h1>
            <p className="text-brand-muted leading-[1.7]">
                Begin your MoneyCash application with secure OTP authentication — designed for quick eligibility and a
                seamless, paperless experience.
            </p>

            <div className="mt-4 flex flex-wrap gap-[10px]">
                {[
                    'Quick Disbursal',
                    'Reliable & Compliant',
                    '100% Digital / Zero Paperwork',
                    'Real-Time / Instant Decisions',
                    'Bank-Grade Security',
                    'Direct Bank Transfer',
                ].map((badge) => (
                    <span
                        key={badge}
                        className="rounded-full border border-[rgba(20,150,243,0.14)] bg-[rgba(255,255,255,0.82)] px-[14px] py-[10px] text-[0.92rem] font-bold text-brand-navy"
                    >
            {badge}
          </span>
                ))}
            </div>

            <div
                className="mt-[18px] inline-flex items-center rounded-[24px] border border-[rgba(18,36,79,0.1)] bg-[rgba(255,255,255,0.92)] px-[16px] py-[14px] shadow-[0_14px_28px_rgba(23,44,113,0.08)] max-sm:rounded-[20px] max-sm:p-3">
                <Image
                    src="/images/moneycash-logo.jpeg"
                    alt="MoneyCash Instant Digital Loans"
                    width={536}
                    height={136}
                    sizes="(max-width: 920px) 100vw, 300px"
                    className="block h-auto w-[min(300px,100%)] max-sm:w-[min(260px,100%)]"
                    priority
                />
            </div>

            <div className="mt-[18px] grid gap-3">
                <div className="mc-inner-card">
                    <strong className="text-brand-navy">2 min start</strong>
                    <span className="block text-brand-muted leading-[1.6]">
            Begin the journey with just your number and OTP verification.
          </span>
                </div>
                <div
                    className="mc-inner-card bg-gradient-to-br from-[rgba(255,244,204,0.94)] to-[rgba(255,255,255,0.92)]">
                    <strong className="text-brand-navy">Trusted onboarding</strong>
                    <span className="block text-brand-muted leading-[1.6]">
            Designed for short-term lending journeys with clear next-step guidance.
          </span>
                </div>
            </div>
        </div>
    );
}

function LandingLowerSections() {
    return (
        <>
            <section className="grid gap-3 nav:grid-cols-3" aria-label="Why choose MoneyCash">
                {highlights.map((item, index) => (
                    <article
                        key={item.title}
                        className="mc-inner-card mc-highlight-card group"
                        style={{animationDelay: `${index * 70}ms`}}
                        aria-labelledby={`highlight-title-${index}`}
                        aria-describedby={`highlight-description-${index}`}
                    >
                        <div className="flex items-start gap-3">
              <span
                  className="mc-highlight-badge relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-[rgba(20,150,243,0.12)] bg-[linear-gradient(145deg,rgba(20,150,243,0.14),rgba(255,197,25,0.2))] shadow-[0_14px_26px_rgba(23,44,113,0.08)]"
                  aria-hidden
              >
                <span className="absolute inset-[5px] rounded-[13px] bg-[rgba(255,255,255,0.82)]"/>
                <span
                    className="absolute left-[7px] top-[7px] h-3 w-3 rounded-full bg-[rgba(255,197,25,0.72)] blur-[1px]"/>
                <span
                    className="mc-highlight-badge-core relative inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[rgba(255,255,255,0.72)] text-brand-navy">
                  <HighlightIcon kind={item.icon}/>
                </span>
              </span>
                            <div className="min-w-0">
                                <h2 id={`highlight-title-${index}`}
                                    className="m-0 text-[1.2rem] leading-[1.2] text-brand-navy">
                                    {item.title}
                                </h2>
                                <p id={`highlight-description-${index}`}
                                   className="mt-2 text-brand-muted leading-[1.6]">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    </article>
                ))}
            </section>

            <section className="mc-card" aria-label="Loan steps">
                <div className="text-[0.9rem] font-black uppercase tracking-[0.14em] text-brand-blue">Simple process
                </div>
                <div className="mt-[14px] grid gap-3 nav:grid-cols-4 nav:gap-4">
                    {steps.map((step, index) => (
                        <div
                            key={step}
                            className="grid items-center gap-3 border-t border-[rgba(18,36,79,0.08)] py-[14px] first:border-t-0 first:pt-0 nav:items-start nav:border-t-0 nav:pt-0"
                            style={{gridTemplateColumns: '40px 1fr'}}
                        >
              <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,rgba(20,150,243,0.14),rgba(255,197,25,0.3))] font-black text-brand-navy"
                  aria-hidden="true"
              >
                {index + 1}
              </span>
                            <strong className="text-brand-navy">
                                <span className="sr-only">{`Step ${index + 1}: `}</span>
                                {step}
                            </strong>
                        </div>
                    ))}
                </div>
            </section>

            <div className="flex flex-wrap gap-[10px] max-[919px]:flex-col max-[919px]:items-stretch">
                <Link href="/my-account?mode=login"
                      className="mc-btn-secondary bg-[rgba(20,150,243,0.08)] text-center text-brand-navy">
                    Already started? Resume with OTP
                </Link>
                {demoInviteHref && (
                    <Link
                        href={demoInviteHref}
                        className="mc-btn-secondary bg-[rgba(255,197,25,0.16)] text-center text-brand-navy"
                        aria-label="Open the demo invite booking flow"
                    >
                        Open Demo Invite Flow
                    </Link>
                )}
            </div>

            <div
                className="grid overflow-hidden rounded-[24px] border border-[rgba(18,36,79,0.1)] bg-[rgba(255,255,255,0.82)]"
                style={{gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'}}
                role="list"
                aria-label="Key loan benefits"
            >
                {BENEFITS_BAR.map((item, index) => (
                    <div
                        key={item.label}
                        role="listitem"
                        className={`flex items-center gap-3 px-5 py-4 ${index < 2 ? 'border-r border-[rgba(18,36,79,0.08)]' : ''} max-sm:flex-col max-sm:gap-2 max-sm:px-3 max-sm:py-3 max-sm:text-center`}
                    >
            <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,rgba(20,150,243,0.12),rgba(255,197,25,0.18))] text-brand-navy">
              {item.icon}
            </span>
                        <div>
                            <strong className="block text-[0.95rem] text-brand-navy">{item.label}</strong>
                            <span className="text-[0.82rem] text-brand-muted">{item.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            <section aria-labelledby="offerings-heading">
                <div className="mc-card">
                    <h2 id="offerings-heading"
                        className="text-[0.9rem] font-black uppercase tracking-[0.1em] text-brand-navy">
                        MoneyCash offerings
                    </h2>
                    <div className="mt-[18px] grid gap-3" style={{gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'}}>
                        {OFFERINGS.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                className="group flex cursor-pointer flex-col items-center gap-[10px] rounded-[18px] border border-[rgba(18,36,79,0.08)] bg-[rgba(244,249,255,0.7)] p-3 text-center transition-all duration-[180ms] hover:-translate-y-[2px] hover:border-[rgba(20,150,243,0.18)] hover:shadow-[0_12px_24px_rgba(23,44,113,0.08)]"
                            >
                <span
                    className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-[16px] bg-[linear-gradient(145deg,rgba(20,150,243,0.14),rgba(255,197,25,0.2))] text-brand-navy transition-transform duration-[180ms] group-hover:scale-[1.06]">
                  {item.icon}
                </span>
                                <div>
                                    <strong
                                        className="block text-[0.88rem] leading-[1.3] text-brand-navy">{item.label}</strong>
                                    <span className="text-[0.76rem] text-brand-muted">{item.sub}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <div className="grid gap-4 nav:grid-cols-2">
                {CONTENT_COLUMNS.map((column) => (
                    <section key={column.id} className="mc-card" aria-labelledby={`${column.id}-heading`}>
                        <div className="mb-[14px] flex items-center justify-between">
                            <h2
                                id={`${column.id}-heading`}
                                className="text-[0.9rem] font-black uppercase tracking-[0.1em] text-brand-navy"
                            >
                                {column.title}
                            </h2>
                            <button type="button"
                                    className="text-[0.84rem] font-extrabold text-brand-blue hover:underline">
                                See all
                            </button>
                        </div>
                        <div className="grid gap-[10px]">
                            {column.items.map((item) => (
                                <div
                                    key={item.label}
                                    className="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[rgba(18,36,79,0.08)] bg-[rgba(244,249,255,0.7)] p-3 px-[14px] transition-colors duration-[160ms] hover:border-[rgba(20,150,243,0.18)]"
                                >
                                    <span
                                        className="text-[0.9rem] font-bold leading-[1.45] text-brand-navy">{item.label}</span>
                                    {item.badge ? (
                                        <span
                                            className="shrink-0 rounded-full bg-[rgba(255,197,25,0.22)] px-[10px] py-[5px] text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-brand-navy">
                      {item.badge}
                    </span>
                                    ) : (
                                        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-brand-muted"
                                             fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}

export function LoanLandingShell({journeyPanel}: { journeyPanel: ReactNode }) {
    return (
        <div className="grid gap-5">
            <section className="grid gap-4.5 nav:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
                <LandingHeroPanel/>
                {journeyPanel}
            </section>
            <LandingLowerSections/>
        </div>
    );
}

import type { PersonalDetailsSection } from '@/app/onboarding/personal-details-step';
import type { EmailMode } from '@/app/onboarding/email-entry-step';

/* ── Email step aside ──────────────────────────────────────────────────────── */

export function EmailAside({ mode }: { mode: EmailMode }) {
  const isLogin = mode === 'login';
  return (
    <aside className="mc-card">
      <div className="mc-chip">{isLogin ? 'Returning user' : 'Next up'}</div>
      <h2 className="mt-[14px] mb-[10px] text-brand-navy text-[clamp(1.9rem,5vw,2.7rem)] tracking-[-0.05em]">
        {isLogin ? 'Hi there.' : 'Verify & continue.'}
      </h2>
      <p className="text-brand-muted leading-[1.6]">
        {isLogin
          ? 'Authenticate with your registered email to access your MoneyCash account and check your loan status.'
          : 'A quick email OTP verifies your identity before we collect your KYC details to process the loan.'}
      </p>
      <div className="grid gap-3 mt-[18px]">
        <div className="mc-inner-card">
          <strong className="text-brand-navy">{isLogin ? 'Authenticate' : 'Step 3b'}</strong>
          <span className="block text-brand-muted leading-[1.6]">
            {isLogin ? 'Enter the 6-digit OTP sent to your email.' : 'Verify the OTP sent to your email address.'}
          </span>
        </div>
        {!isLogin && (
          <div className="mc-inner-card bg-gradient-to-br from-[rgba(255,244,204,0.94)] to-[rgba(255,255,255,0.92)]">
            <strong className="text-brand-navy">Step 4</strong>
            <span className="block text-brand-muted leading-[1.6]">
              Share personal details — name, gender, DOB, occupation, city, and pincode.
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ── Email OTP step aside ──────────────────────────────────────────────────── */

export function EmailOtpAside({ mode }: { mode: EmailMode }) {
  const isLogin = mode === 'login';
  return (
    <aside className="mc-card">
      <div className="mc-chip">{isLogin ? 'Almost in' : 'Next up'}</div>
      <h2 className="mt-[14px] mb-[10px] text-brand-navy text-[clamp(1.9rem,5vw,2.7rem)] tracking-[-0.05em]">
        {isLogin ? 'One code away.' : 'Personal details.'}
      </h2>
      <p className="text-brand-muted leading-[1.6]">
        {isLogin
          ? "Enter the 6-digit code from your email and you're in. Your session is secured end-to-end."
          : "Once your email is confirmed, we'll collect a few KYC details to complete your loan application."}
      </p>
      <div className="grid gap-3 mt-[18px]">
        <div className="mc-inner-card">
          <strong className="text-brand-navy">{isLogin ? 'Secure session' : 'Step 4'}</strong>
          <span className="block text-brand-muted leading-[1.6]">
            {isLogin
              ? 'We create a protected session upon successful OTP verification.'
              : 'Full name, gender, date of birth, occupation, address, city, and residential pincode.'}
          </span>
        </div>
        <div className="mc-inner-card bg-gradient-to-br from-[rgba(255,244,204,0.94)] to-[rgba(255,255,255,0.92)]">
          <strong className="text-brand-navy">{isLogin ? 'Your dashboard' : 'Bank-grade security'}</strong>
          <span className="block text-brand-muted leading-[1.6]">
            {isLogin
              ? 'View trips, invoices, and outstanding payments in one place.'
              : 'All personal data is encrypted at rest and never shared with third parties.'}
          </span>
        </div>
      </div>
    </aside>
  );
}

/* ── Personal details step aside ───────────────────────────────────────────── */

type SectionSummaryCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  isActive: boolean;
  isComplete: boolean;
};

function SectionSummaryCard({ eyebrow, title, description, isActive, isComplete }: SectionSummaryCardProps) {
  return (
    <div
      className={`rounded-[20px] border px-4 py-3.5 transition-all duration-[180ms] ${
        isActive
          ? 'border-[rgba(20,150,243,0.2)] bg-[rgba(20,150,243,0.08)] shadow-[0_12px_22px_rgba(23,44,113,0.08)]'
          : 'border-[rgba(18,36,79,0.08)] bg-[rgba(248,251,255,0.7)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-brand-blue">{eyebrow}</span>
          <h2 className="text-[1rem] font-extrabold tracking-[-0.02em] text-brand-navy">{title}</h2>
          <p className="text-[0.84rem] leading-[1.55] text-brand-muted">{description}</p>
        </div>
        <span
          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[0.72rem] font-extrabold ${
            isComplete
              ? 'bg-[rgba(36,168,111,0.12)] text-[#17624a]'
              : isActive
              ? 'bg-[rgba(20,150,243,0.12)] text-brand-blue'
              : 'bg-[rgba(18,36,79,0.08)] text-brand-muted'
          }`}
        >
          {isComplete ? 'Done' : isActive ? 'Now' : 'Next'}
        </span>
      </div>
    </div>
  );
}

export function PersonalDetailsAside({ activeSection }: { activeSection: PersonalDetailsSection }) {
  return (
    <aside className="mc-card">
      <div className="mc-chip">Final step</div>
      <h2 className="mt-[14px] mb-[10px] text-brand-navy text-[clamp(1.9rem,5vw,2.7rem)] tracking-[-0.05em]">
        Almost there.
      </h2>
      <p className="text-brand-muted leading-[1.6]">
        These KYC details are required under RBI guidelines for digital lending. They help us confirm your
        eligibility and process your request faster.
      </p>
      <div className="grid gap-3 mt-[18px]">
        <SectionSummaryCard
          eyebrow="Part 1"
          title="Personal profile"
          description="Name, gender, date of birth, and occupation."
          isActive={activeSection === 'profile'}
          isComplete={activeSection === 'financial'}
        />
        <SectionSummaryCard
          eyebrow="Part 2"
          title="Address and income"
          description="Address, city, pincode, earnings, and final consent."
          isActive={activeSection === 'financial'}
          isComplete={false}
        />
        <div className="mc-inner-card">
          <strong className="text-brand-navy">Why these details?</strong>
          <span className="block text-brand-muted leading-[1.6]">
            DOB, occupation, and address details help verify identity and support credit eligibility checks.
          </span>
        </div>
        <div className="mc-inner-card bg-gradient-to-br from-[rgba(255,244,204,0.94)] to-[rgba(255,255,255,0.92)]">
          <strong className="text-brand-navy">Encrypted & secure</strong>
          <span className="block text-brand-muted leading-[1.6]">
            Your data is encrypted at every step and never stored in plain text.
          </span>
        </div>
      </div>
    </aside>
  );
}

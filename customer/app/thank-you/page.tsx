import Link from 'next/link';

export const metadata = { title: 'Application Received — MoneyCash' };

export default function ThankYouPage() {
  return (
    <div className="grid gap-[18px] nav:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <div className="mc-card flex flex-col gap-6">
        <div className="mc-chip">Application received</div>
        <h1 className="text-brand-navy text-[clamp(2rem,5vw,3rem)] tracking-[-0.05em] leading-[1.1]">
          Thank you for applying.
        </h1>
        <p className="text-brand-muted leading-[1.7] max-w-prose">
          We have received your application and our team will review it shortly.
          You will hear from us via email once the review is complete.
        </p>
        <p className="text-brand-muted leading-[1.7] max-w-prose">
          This typically takes 1–2 business days. You do not need to take any further action right now.
        </p>
        <Link href="/" className="mc-btn-secondary self-start">
          Back to home
        </Link>
      </div>

      <aside className="mc-card">
        <div className="mc-chip">What happens next</div>
        <h2 className="mt-[14px] mb-[10px] text-brand-navy text-[clamp(1.9rem,5vw,2.7rem)] tracking-[-0.05em]">
          Under review.
        </h2>
        <p className="text-brand-muted leading-[1.6]">
          Our lending partners will assess your application against eligibility criteria
          and notify you of the outcome.
        </p>
        <div className="grid gap-3 mt-[18px]">
          <div className="mc-inner-card">
            <strong className="text-brand-navy">Review period</strong>
            <span className="block text-brand-muted leading-[1.6]">
              Most applications are reviewed within 1–2 business days.
            </span>
          </div>
          <div className="mc-inner-card bg-gradient-to-br from-[rgba(255,244,204,0.94)] to-[rgba(255,255,255,0.92)]">
            <strong className="text-brand-navy">Questions?</strong>
            <span className="block text-brand-muted leading-[1.6]">
              Contact our support team if you have any concerns about your application.
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}

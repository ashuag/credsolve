import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your Loan Offer — MoneyCash' };

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function LoanOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string; score?: string }>;
}) {
  const q = await searchParams;
  const approvedAmount = q.amount ? parseInt(q.amount, 10) : null;
  const cibilScore     = q.score   ? parseInt(q.score,  10) : null;

  return (
    <div className="grid gap-[18px] nav:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      {/* Main offer card */}
      <div className="mc-card flex flex-col gap-6">
        <div className="mc-chip">Pre-approved offer</div>
        <h1 className="text-brand-navy text-[clamp(2rem,5vw,3rem)] tracking-[-0.05em] leading-[1.1]">
          You are eligible!
        </h1>

        {approvedAmount && (
          <div className="mc-highlight-card flex flex-col gap-1">
            <span className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-brand-blue">
              Approved loan limit
            </span>
            <span className="text-[clamp(2.4rem,6vw,3.6rem)] font-extrabold tracking-[-0.04em] text-brand-navy leading-none">
              {formatInr(approvedAmount)}
            </span>
            <span className="text-brand-muted text-[0.9rem] leading-[1.5] mt-1">
              Short-term bullet loan — repayable in a single instalment.
            </span>
          </div>
        )}

        <div className="grid gap-3">
          {cibilScore && (
            <div className="mc-inner-card flex items-center justify-between">
              <span className="text-brand-navy font-semibold">CIBIL Vision Score</span>
              <span className="text-brand-blue font-extrabold text-lg">{cibilScore}</span>
            </div>
          )}
          <div className="mc-inner-card flex items-center justify-between">
            <span className="text-brand-navy font-semibold">Loan type</span>
            <span className="text-brand-muted">Unsecured bullet loan</span>
          </div>
          <div className="mc-inner-card flex items-center justify-between">
            <span className="text-brand-navy font-semibold">Repayment</span>
            <span className="text-brand-muted">Single instalment</span>
          </div>
          <div className="mc-inner-card flex items-center justify-between">
            <span className="text-brand-navy font-semibold">Processing</span>
            <span className="text-brand-muted">1–2 business days</span>
          </div>
        </div>

        <p className="text-[0.875rem] leading-[1.65] text-brand-muted">
          This is a pre-approved offer based on your credit profile. Final disbursement is subject
          to document verification by the lending partner.
        </p>

        <div className="flex gap-3 flex-wrap">
          <Link href="/my-account" className="mc-btn-primary">
            Go to my account
          </Link>
          <Link href="/" className="mc-btn-secondary">
            Back to home
          </Link>
        </div>
      </div>

      {/* Aside */}
      <aside className="mc-card">
        <div className="mc-chip">Next steps</div>
        <h2 className="mt-[14px] mb-[10px] text-brand-navy text-[clamp(1.9rem,5vw,2.7rem)] tracking-[-0.05em]">
          What happens now.
        </h2>
        <p className="text-brand-muted leading-[1.6]">
          Your application is with our lending partners. Here is what to expect next.
        </p>
        <div className="grid gap-3 mt-[18px]">
          <div className="mc-inner-card">
            <strong className="text-brand-navy">Document review</strong>
            <span className="block text-brand-muted leading-[1.6]">
              Our team will verify your submitted details and may request supporting documents.
            </span>
          </div>
          <div className="mc-inner-card">
            <strong className="text-brand-navy">Final approval</strong>
            <span className="block text-brand-muted leading-[1.6]">
              Once verified, the lending partner issues the final sanction letter.
            </span>
          </div>
          <div className="mc-inner-card bg-gradient-to-br from-[rgba(255,244,204,0.94)] to-[rgba(255,255,255,0.92)]">
            <strong className="text-brand-navy">Disbursement</strong>
            <span className="block text-brand-muted leading-[1.6]">
              Funds are credited to your registered bank account within 1–2 business days of approval.
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}

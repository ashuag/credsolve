import { AccountDetailsForm } from './account-details-form';
import { CustomerLeadStatusGate } from '@/components/auth/customer-lead-status-gate';
import { SectionPanel } from '@/components/ui/section-panel';

export default function AccountPage() {
  return (
    <CustomerLeadStatusGate allowedStatuses={['IN_PROGRESS']}>
      <div className="grid gap-[18px] nav:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <SectionPanel
          className="overflow-visible"
          eyebrow="My Account"
          title="Create Account."
          description="Complete the core identity details required to move your MoneyCash account toward offer review and KYC."
        >
          <AccountDetailsForm />
        </SectionPanel>

        <aside className="mc-card">
          <div className="mc-chip">Final step</div>
          <h2 className="mt-[14px] mb-[10px] text-brand-navy text-[clamp(1.9rem,5vw,2.7rem)] tracking-[-0.05em]">
            Almost there.
          </h2>
          <p className="text-brand-muted leading-[1.6]">
            These KYC details are required under RBI guidelines for digital lending. They help confirm
            your eligibility and process your request faster.
          </p>
          <div className="grid gap-3 mt-[18px]">
            <div className="mc-inner-card">
              <strong className="text-brand-navy">Why these details?</strong>
              <span className="block text-brand-muted leading-[1.6]">
                DOB, occupation, and address details help verify identity and support credit eligibility checks.
              </span>
            </div>
            <div className="mc-inner-card bg-gradient-to-br from-[rgba(255,244,204,0.94)] to-[rgba(255,255,255,0.92)]">
              <strong className="text-brand-navy">Encrypted &amp; secure</strong>
              <span className="block text-brand-muted leading-[1.6]">
                Your data is encrypted at every step and never stored in plain text.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </CustomerLeadStatusGate>
  );
}

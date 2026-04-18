import type { Metadata } from 'next';
import { CustomerLeadStatusGate } from '@/components/auth/customer-lead-status-gate';
import { SectionPanel } from '@/components/ui/section-panel';
import { ProfessionalDetailsForm } from './professional-details-form';

export const metadata: Metadata = {
  title: 'Professional Details | MoneyCash'
};

export default function ProfessionalDetailsPage() {
  return (
    <CustomerLeadStatusGate allowedStatuses={['IN_PROGRESS']}>
      <div className="grid gap-[18px] nav:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <SectionPanel
          className="overflow-visible"
          eyebrow="Professional Details"
          title="Your work profile."
          description="Tell us about your occupation and income so we can match you with the right loan offer."
        >
          <ProfessionalDetailsForm />
        </SectionPanel>

        <aside className="mc-card">
          <div className="mc-chip">Step 2 of 2</div>
          <h2 className="mt-[14px] mb-[10px] text-brand-navy text-[clamp(1.9rem,5vw,2.7rem)] tracking-[-0.05em]">
            Almost done.
          </h2>
          <p className="text-brand-muted leading-[1.6]">
            Your occupation and income details help lenders assess eligibility quickly and offer you the best
            possible loan terms.
          </p>
          <div className="grid gap-3 mt-[18px]">
            <div className="mc-inner-card">
              <strong className="text-brand-navy">Why income details?</strong>
              <span className="block text-brand-muted leading-[1.6]">
                Income data is used only for credit assessment — it determines your loan limit and repayment terms.
              </span>
            </div>
            <div className="mc-inner-card bg-gradient-to-br from-[rgba(255,244,204,0.94)] to-[rgba(255,255,255,0.92)]">
              <strong className="text-brand-navy">Encrypted &amp; secure</strong>
              <span className="block text-brand-muted leading-[1.6]">
                All financial data is encrypted at rest and shared only with your chosen lending partner.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </CustomerLeadStatusGate>
  );
}

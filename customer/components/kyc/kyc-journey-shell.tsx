'use client';

import type { ReactNode } from 'react';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { KycVerifyLeftRail } from '@/components/kyc/kyc-verify-left-rail';
import { useCustomerSession } from '@/components/providers/customer-session-provider';

type KycJourneyShellProps = {
  journeyPanel: ReactNode;
  mobileStepLabel?: string;
  mobileOnBack?: () => void;
};

/** Same mobile header + desktop split as OTP / personal details. */
export function KycJourneyShell({
  journeyPanel,
  mobileStepLabel = 'KYC',
  mobileOnBack,
}: KycJourneyShellProps) {
  const { session } = useCustomerSession();
  const profile = session?.authenticated === true ? session.profile : null;

  return (
    <LoanLandingShell
      showSpeedometer
      journeyPanel={journeyPanel}
      leftTitle={
        <>
          Verify your <span className="text-[#60a5fa]">identity</span>
        </>
      }
      leftDescription="Share Aadhaar from DigiLocker, then a quick selfie. Paperless and secure."
      leftInfographic={<KycVerifyLeftRail profile={profile} />}
      mobileStepLabel={mobileStepLabel}
      mobileOnBack={mobileOnBack}
    />
  );
}

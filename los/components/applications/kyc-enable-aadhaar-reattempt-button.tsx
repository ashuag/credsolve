'use client';

import { enableAadhaarReattempt, type LosApplicationDetails } from '@/lib/api';
import { canRetryLosApplicationSteps } from '@/lib/access';
import { getLosStoredUser } from '@/lib/auth';
import { canEnableAadhaarReattemptFromRow } from '@/lib/kyc-grant-retry-eligibility';
import { useState } from 'react';

export function KycEnableAadhaarReattemptButton({
  row,
  applicationUuid,
  authToken,
  onSuccess,
  className,
}: {
  row: Pick<
    LosApplicationDetails,
    | 'canEnableAadhaarReattempt'
    | 'aadhaarKycCompleted'
    | 'aadhaarNameMatchPendingReview'
    | 'aadhaarIdentityFailure'
    | 'aadhaarDetail'
    | 'aadhaarDownloadLogs'
    | 'statusCode'
    | 'kycStatus'
    | 'lead'
    | 'kycPhotos'
  >;
  applicationUuid: string;
  authToken: string | null;
  onSuccess?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allowed] = useState(() => {
    const user = getLosStoredUser();
    return canRetryLosApplicationSteps(user?.roleName ?? user?.role, user?.hierarchyLevel);
  });

  const eligible = allowed && (row.canEnableAadhaarReattempt || canEnableAadhaarReattemptFromRow(row));

  if (!eligible) return null;

  const handleEnable = async () => {
    if (!authToken || busy) return;
    const confirmed = window.confirm(
      'Enable reattempt Aadhaar KYC? The customer will start Aadhaar OTP again from the app. Previous OTP and DigiLocker attempt counts will be cleared.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await enableAadhaarReattempt(authToken, applicationUuid);
      const parts = ['Aadhaar KYC reattempt enabled — customer should start Aadhaar OTP again in the app.'];
      if (result.leadRecovered || result.applicationRecovered) {
        parts.push('Lead/application moved back to in progress.');
      }
      setMessage(parts.join(' '));
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable Aadhaar KYC reattempt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        className="los-btn-primary min-h-[38px] px-4 text-[0.82rem]"
        disabled={!authToken || busy}
        onClick={() => void handleEnable()}
      >
        {busy ? 'Enabling…' : 'Enable reattempt Aadhaar KYC'}
      </button>
      {message ? (
        <p className="m-0 mt-2 text-[0.82rem] leading-[1.45] text-[var(--ok,#15803d)]">{message}</p>
      ) : null}
      {error ? (
        <p className="m-0 mt-2 text-[0.82rem] leading-[1.45] text-[var(--bad,#b91c1c)]">{error}</p>
      ) : null}
    </div>
  );
}

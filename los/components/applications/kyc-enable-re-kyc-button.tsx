'use client';

import { enableReKyc, type LosApplicationDetails } from '@/lib/api';
import { canRetryLosApplicationSteps } from '@/lib/access';
import { getLosStoredUser } from '@/lib/auth';
import { canEnableReKycFromRow } from '@/lib/kyc-grant-retry-eligibility';
import { useState } from 'react';

export function KycEnableReKycButton({
  row,
  applicationUuid,
  authToken,
  onSuccess,
  className,
}: {
  row: Pick<
    LosApplicationDetails,
    | 'canEnableReKyc'
    | 'kycStatus'
    | 'livenessPassed'
    | 'livenessCheckCompleted'
    | 'livenessAttempts'
    | 'livenessCheckedAt'
    | 'statusCode'
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

  const eligible = allowed && (row.canEnableReKyc || canEnableReKycFromRow(row));

  if (!eligible) return null;

  const handleEnable = async () => {
    if (!authToken || busy) return;
    const confirmed = window.confirm(
      'Re-enable KYC selfie for this customer? They will retake selfie and liveness in the app. DigiLocker Aadhaar will not be requested again if it is already complete.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await enableReKyc(authToken, applicationUuid);
      const parts = [
        result.digilockerPreserved || !result.digilockerCleared
          ? 'KYC selfie re-enabled — DigiLocker Aadhaar was kept; customer should retake selfie in the app.'
          : 'KYC selfie re-enabled — customer should continue KYC from the app.',
      ];
      if (result.leadRecovered || result.applicationRecovered) {
        parts.push('Lead/application moved back to in progress.');
      }
      setMessage(parts.join(' '));
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to re-enable KYC selfie.');
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
        {busy ? 'Enabling…' : 'Re-enable KYC Selfie'}
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

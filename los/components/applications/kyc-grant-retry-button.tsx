'use client';

import { grantKycLivenessRetry, type LosApplicationDetails } from '@/lib/api';
import { canGrantKycLivenessRetryFromRow } from '@/lib/kyc-grant-retry-eligibility';
import { useState } from 'react';

export function KycGrantRetryButton({
  row,
  applicationUuid,
  authToken,
  onSuccess,
  className,
}: {
  row: Pick<
    LosApplicationDetails,
    | 'canGrantKycLivenessRetry'
    | 'kycStatus'
    | 'livenessPassed'
    | 'livenessCheckCompleted'
    | 'livenessAttempts'
    | 'livenessCheckedAt'
    | 'statusCode'
    | 'lead'
  >;
  applicationUuid: string;
  authToken: string | null;
  onSuccess?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligible =
    row.canGrantKycLivenessRetry || canGrantKycLivenessRetryFromRow(row);

  if (!eligible) return null;

  const handleGrant = async () => {
    if (!authToken || busy) return;
    const confirmed = window.confirm(
      'Grant this customer one more KYC liveness attempt? They will be able to return to the selfie step and try again.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await grantKycLivenessRetry(authToken, applicationUuid);
      setMessage(
        result.leadRecovered
          ? 'Retry granted. Lead moved back to in progress — customer can resume KYC.'
          : 'Retry granted — customer can resume KYC from the selfie step.',
      );
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to grant KYC retry.');
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
        onClick={() => void handleGrant()}
      >
        {busy ? 'Granting…' : 'Grant customer 1 KYC retry'}
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

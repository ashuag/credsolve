'use client';

import { enableReKyc, type LosApplicationDetails } from '@/lib/api';
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

  const eligible = row.canEnableReKyc || canEnableReKycFromRow(row);

  if (!eligible) return null;

  const handleEnable = async () => {
    if (!authToken || busy) return;
    const confirmed = window.confirm(
      'Enable re-KYC for this customer? This resets KYC so they can redo DigiLocker / document verification. DigiLocker is cleared only when KYC previously failed identity checks.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await enableReKyc(authToken, applicationUuid);
      const parts = ['Re-KYC enabled — customer can redo KYC from the app.'];
      if (result.digilockerCleared) {
        parts.push('DigiLocker Aadhaar was cleared; they must reconnect DigiLocker.');
      }
      if (result.leadRecovered || result.applicationRecovered) {
        parts.push('Lead/application moved back to in progress.');
      }
      setMessage(parts.join(' '));
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable re-KYC.');
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
        {busy ? 'Enabling…' : 'Enable re-KYC'}
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

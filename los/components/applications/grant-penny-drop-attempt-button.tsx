'use client';

import { grantPennyDropAttempt, type LosApplicationDetails } from '@/lib/api';
import { canGrantPennyDropAttemptFromRow } from '@/lib/penny-drop-grant-retry-eligibility';
import { useState } from 'react';

export function GrantPennyDropAttemptButton({
  row,
  applicationUuid,
  authToken,
  onSuccess,
  className,
}: {
  row: Pick<
    LosApplicationDetails,
    'canGrantPennyDropAttempt' | 'statusCode' | 'lead' | 'disbursement' | 'loanAccount' | 'pennyDropVerification'
  >;
  applicationUuid: string;
  authToken: string | null;
  onSuccess?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligible = row.canGrantPennyDropAttempt || canGrantPennyDropAttemptFromRow(row);

  if (!eligible && !message) return null;

  const handleGrant = async () => {
    if (!authToken || busy) return;
    const confirmed = window.confirm(
      'Give this customer one more bank verification (penny drop) attempt? They can retry from the bank details screen after refreshing.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await grantPennyDropAttempt(authToken, applicationUuid);
      setMessage(
        `One more bank verification attempt granted (${result.attemptsRemaining} remaining). Ask the customer to refresh the bank details page and try again.`,
      );
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to grant another bank verification attempt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className} style={{ marginBottom: 16 }}>
      {eligible ? (
        <button
          type="button"
          className="los-btn-primary min-h-[38px] px-4 text-[0.82rem]"
          disabled={!authToken || busy}
          onClick={() => void handleGrant()}
        >
          {busy ? 'Granting…' : 'Allow re-attempt'}
        </button>
      ) : null}
      {message ? (
        <p className="m-0 mt-2 text-[0.82rem] leading-[1.45] text-[var(--ok,#15803d)]">{message}</p>
      ) : null}
      {error ? (
        <p className="m-0 mt-2 text-[0.82rem] leading-[1.45] text-[var(--bad,#b91c1c)]">{error}</p>
      ) : null}
    </div>
  );
}

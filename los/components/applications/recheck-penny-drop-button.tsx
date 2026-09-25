'use client';

import { recheckPennyDrop, type LosApplicationDetails } from '@/lib/api';
import { canRetryLosApplicationSteps } from '@/lib/access';
import { getLosStoredUser } from '@/lib/auth';
import { canRecheckPennyDropFromRow } from '@/lib/penny-drop-grant-retry-eligibility';
import { useState } from 'react';

export function RecheckPennyDropButton({
  row,
  applicationUuid,
  authToken,
  onSuccess,
  className,
}: {
  row: Pick<
    LosApplicationDetails,
    | 'canRecheckPennyDrop'
    | 'statusCode'
    | 'lead'
    | 'disbursement'
    | 'loanAccount'
    | 'nameMatchPendingReview'
    | 'bankAccountAttempts'
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

  const eligible = allowed && (row.canRecheckPennyDrop || canRecheckPennyDropFromRow(row));

  if (!eligible && !message) return null;

  const handleRecheck = async () => {
    if (!authToken || busy) return;
    const confirmed = window.confirm(
      'Recheck penny drop on the last submitted bank account? This calls bank verification again and updates the result. It does not use one of the customer’s attempts.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await recheckPennyDrop(authToken, applicationUuid);
      setMessage(result.message);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to recheck penny drop.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className} style={{ marginBottom: 16 }}>
      {eligible ? (
        <button
          type="button"
          className="min-h-[38px] rounded-[8px] border border-[rgba(15,39,72,0.22)] bg-white px-4 text-[0.82rem] font-bold text-brand-navy hover:bg-[rgba(15,39,72,0.04)] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={!authToken || busy}
          onClick={() => void handleRecheck()}
        >
          {busy ? 'Rechecking…' : 'Recheck penny drop'}
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

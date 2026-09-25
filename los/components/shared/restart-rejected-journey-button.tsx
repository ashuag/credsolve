'use client';

import {
  restartRejectedApplicationJourney,
  restartRejectedLeadJourney,
} from '@/lib/api';
import { canRestartRejectedJourney } from '@/lib/access';
import { getLosStoredUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RestartRejectedJourneyButton({
  token,
  leadUuid,
  applicationUuid,
  statusCode,
  className,
}: {
  token: string | null;
  leadUuid?: string;
  applicationUuid?: string;
  statusCode: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowed] = useState(() => {
    const user = getLosStoredUser();
    return canRestartRejectedJourney(user?.roleName ?? user?.role, user?.hierarchyLevel);
  });

  const rejected = statusCode.trim().toUpperCase() === 'REJECTED';
  if (!allowed || !rejected) return null;

  const handleRestart = async () => {
    if (!token || busy) return;
    const confirmed = window.confirm(
      'Start a new customer journey from this rejected case?\n\n' +
        'Name, DOB, address, occupation, income, and PAN number will be copied onto a new lead. ' +
        'Pre-BRE runs immediately. The customer must confirm PAN so CIBIL (reuse or fresh pull) and post-BRE run again. ' +
        'Loan selection, KYC, and bank verification are not copied. The rejected record stays in history.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const result = applicationUuid
        ? await restartRejectedApplicationJourney(token, applicationUuid)
        : await restartRejectedLeadJourney(token, leadUuid!);
      const copied =
        result.copiedFields.length > 0
          ? ` Copied: ${result.copiedFields.join(', ')}.`
          : ' No profile fields were available to copy.';
      const breNote = result.preBreRejected
        ? ' Pre-BRE rejected the new lead.'
        : '';
      window.alert(`New journey ${result.newLeadNumber} created.${copied}${breNote}`);
      router.push(`/leads/${result.newLeadUuid}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to restart the customer journey.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        className="los-btn-primary min-h-[38px] px-4 text-[0.82rem]"
        disabled={!token || busy}
        onClick={() => void handleRestart()}
      >
        {busy ? 'Reapplying…' : 'Reapply'}
      </button>
      {error ? (
        <p className="m-0 mt-2 text-[0.82rem] leading-[1.45] text-[#b91c1c]">{error}</p>
      ) : null}
    </div>
  );
}

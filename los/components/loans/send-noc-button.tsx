'use client';

import { canSendLoanNoc } from '@/lib/access';
import { getLosStoredUser } from '@/lib/auth';
import { useEffect, useState } from 'react';

const BUTTON_CLASS =
  'h-[28px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.12)] px-2 text-[0.72rem] font-bold text-[#047857] transition-colors hover:bg-[rgba(16,185,129,0.2)] disabled:cursor-not-allowed disabled:opacity-50';

export function useCanSendLoanNoc() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const user = getLosStoredUser();
    setAllowed(canSendLoanNoc(user?.roleName ?? user?.role, user?.hierarchyLevel));
  }, []);

  return allowed;
}

/** Fully repaid and still waiting for a manual NOC. */
export function loanNeedsNoc(loan: {
  isNocSent: boolean;
  closedAt: string | null;
  loanStatusCode: string;
}): boolean {
  if (loan.isNocSent) return false;
  const code = loan.loanStatusCode.toUpperCase();
  if (code === 'WRITTEN_OFF') return false;
  return Boolean(loan.closedAt) || code === 'CLOSED' || code === 'SETTLED';
}

export function SendNocButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  const allowed = useCanSendLoanNoc();
  if (!allowed) return null;

  return (
    <button
      type="button"
      disabled={busy}
      className={BUTTON_CLASS}
      title="Generate the closure letter, store it, and email it to the borrower."
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {busy ? 'Sending NOC…' : 'Send NOC'}
    </button>
  );
}

'use client';

import { canDecideLosApplication } from '@/lib/access';
import { getLosStoredUser } from '@/lib/auth';
import { useEffect, useState } from 'react';

const BUTTON_CLASS =
  'h-[28px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.08)] px-2 text-[0.72rem] font-bold text-brand-blue transition-colors hover:bg-[rgba(34,197,94,0.14)] disabled:cursor-not-allowed disabled:opacity-50';

export function useCanRefreshLoanPayment() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const user = getLosStoredUser();
    setAllowed(canDecideLosApplication(user?.roleName ?? user?.role, user?.hierarchyLevel));
  }, []);

  return allowed;
}

export function RefreshPaymentButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  const allowed = useCanRefreshLoanPayment();
  if (!allowed) return null;

  return (
    <button
      type="button"
      disabled={busy}
      className={BUTTON_CLASS}
      title="Fetch the latest status from Easebuzz and record the repayment if it is already paid."
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {busy ? 'Refreshing…' : 'Refresh payment'}
    </button>
  );
}

'use client';

import { canMarkInternalTesting } from '@/lib/access';
import { getLosStoredUser } from '@/lib/auth';
import { useEffect, useState } from 'react';

const BUTTON_CLASS =
  'h-[28px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-2 text-[0.72rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.06)] disabled:cursor-not-allowed disabled:opacity-50';

export function useCanMarkInternalTesting() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const user = getLosStoredUser();
    setAllowed(canMarkInternalTesting(user?.roleName ?? user?.role, user?.hierarchyLevel));
  }, []);

  return allowed;
}

export function MarkInternalTestingButton({
  busy,
  onConfirm,
}: {
  busy: boolean;
  onConfirm: () => void;
}) {
  const allowed = useCanMarkInternalTesting();
  if (!allowed) return null;

  return (
    <button
      type="button"
      disabled={busy}
      className={BUTTON_CLASS}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const confirmed = window.confirm(
          'Mark as internal testing? This record will be hidden from the listing and data dump.',
        );
        if (!confirmed) return;
        onConfirm();
      }}
    >
      {busy ? 'Marking…' : 'Mark as internal testing'}
    </button>
  );
}

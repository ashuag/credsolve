'use client';

// Temporarily hidden — restore imports + implementations below to re-enable the button.
// import { canMarkInternalTesting } from '@/lib/access';
// import { getLosStoredUser } from '@/lib/auth';
// import { useEffect, useState } from 'react';

export function useCanMarkInternalTesting() {
  return false;
  /*
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const user = getLosStoredUser();
    setAllowed(canMarkInternalTesting(user?.roleName ?? user?.role, user?.hierarchyLevel));
  }, []);

  return allowed;
  */
}

export function MarkInternalTestingButton({
  busy: _busy,
  onConfirm: _onConfirm,
}: {
  busy: boolean;
  onConfirm: () => void;
}) {
  return null;
  /*
  const BUTTON_CLASS =
    'h-[28px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-transparent px-2 text-[0.72rem] font-bold text-brand-text transition-colors hover:bg-[rgba(34,197,94,0.06)] disabled:cursor-not-allowed disabled:opacity-50';

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
  */
}

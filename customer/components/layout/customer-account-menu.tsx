'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { logoutCustomer } from '@/lib/api/auth';
import { buildHrefWithSearch } from '@/lib/navigation';

const TRIGGER_CLASS =
  'inline-flex items-center justify-center gap-2 min-h-[42px] min-w-0 max-w-[min(280px,calc(100vw-6rem))] pl-5 pr-4 py-2.5 rounded-full font-extrabold text-[0.92rem] sm:text-[0.96rem] text-[#fff8df] bg-[linear-gradient(135deg,#1c347d_0%,#12244f_100%)] shadow-[0_12px_28px_rgba(23,44,113,0.25)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(23,44,113,0.35)]';

type CustomerAccountMenuProps = {
  triggerLabel: string;
};

export function CustomerAccountMenu({ triggerLabel }: CustomerAccountMenuProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useCustomerSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const accountHref = buildHrefWithSearch('/my-account', searchParams);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    function onPointerDown(e: MouseEvent) {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) closeMenu();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [menuOpen, closeMenu]);

  async function handleLogout() {
    closeMenu();
    try {
      await logoutCustomer();
    } catch {
      /* still refresh if cookie cleared */
    }
    await refresh();
    router.push('/');
    router.refresh();
  }

  const menuItemsClass =
    'block w-full px-5 py-3 text-left text-base font-bold text-brand-navy hover:bg-[rgba(20,150,243,0.08)] transition-colors duration-150';

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={`Account menu (${triggerLabel})`}
        className={TRIGGER_CLASS}
      >
        <span className="truncate">{triggerLabel}</span>
        <svg
          className={`w-4 h-4 shrink-0 transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 min-w-[220px] rounded-[16px] border border-[rgba(18,36,79,0.12)] bg-white py-2 shadow-[0_16px_40px_rgba(23,44,113,0.18)] z-[60]"
        >
          <Link href={accountHref} role="menuitem" className={menuItemsClass} onClick={closeMenu}>
            My account
          </Link>
          <Link href={applyHref} role="menuitem" className={menuItemsClass} onClick={closeMenu}>
            Apply for a loan
          </Link>
          <div className="my-1 border-t border-[rgba(18,36,79,0.08)]" aria-hidden />
          <button type="button" role="menuitem" className={menuItemsClass} onClick={() => void handleLogout()}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

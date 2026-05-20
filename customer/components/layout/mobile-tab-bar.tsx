'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { isCustomerPortalSignedIn } from '@/lib/api/customer-session';

type IconProps = { active: boolean };

function HomeIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1v-9.5z" />
      {active && <path d="M9 21v-6h6v6" />}
    </svg>
  );
}

function ShieldIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3.2v5.3c0 4.4-2.7 7.8-7 9.5-4.3-1.7-7-5.1-7-9.5V6.2L12 3z" />
      <path d="M9.3 12.2l1.9 1.9 3.8-4.2" />
    </svg>
  );
}

function CardIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" strokeLinecap="round" />
    </svg>
  );
}

type Tab = {
  href: string;
  label: string;
  Icon: ComponentType<IconProps>;
  exact?: boolean;
};

function isActive(pathname: string | null, tab: Tab, accountHref: string) {
  const path = pathname ?? '';
  if (tab.exact) return path === tab.href;
  if (tab.href === '__account__') {
    return (
      path === accountHref ||
      path === '/dashboard' ||
      path === '/my-account' ||
      path === '/apply-for-loan' ||
      path === '/login' ||
      path.startsWith('/account')
    );
  }
  return path.startsWith(tab.href);
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { session } = useCustomerSession();
  const signedIn = isCustomerPortalSignedIn(session);
  const accountHref = signedIn ? '/dashboard' : '/my-account';

  const tabs: Tab[] = [
    { href: '/', label: 'Home', Icon: HomeIcon, exact: true },
    { href: '__account__', label: signedIn ? 'Accounts' : 'Account', Icon: ShieldIcon },
    { href: '/payments', label: 'Payments', Icon: CardIcon },
  ];

  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      <div
        className="border-t border-[rgba(18,36,79,0.1)] shadow-[0_-8px_32px_rgba(23,44,113,0.1)]"
        style={{
          background: 'rgba(255, 253, 248, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="grid h-[60px]" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((tab) => {
            const href = tab.href === '__account__' ? accountHref : tab.href;
            const active = isActive(pathname, tab, accountHref);

            return (
              <Link
                key={tab.href === '__account__' ? `account-${accountHref}` : tab.href}
                href={href}
                className="relative flex flex-col items-center justify-center gap-[3px] transition-all duration-150 active:scale-95"
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-b-full bg-brand-blue"
                    aria-hidden
                  />
                )}
                <span className={`transition-colors duration-150 ${active ? 'text-brand-blue' : 'text-brand-muted'}`}>
                  <tab.Icon active={active} />
                </span>
                <span
                  className={`text-[0.65rem] font-extrabold tracking-[0.04em] transition-colors duration-150 ${
                    active ? 'text-brand-blue' : 'text-brand-muted'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

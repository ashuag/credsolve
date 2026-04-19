'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { ELIGIBILITY_SECTION_DEFINITIONS } from '@/components/eligibility/eligibility-definitions';
import { useNavigationProgress } from '@/components/ui/navigation-progress-provider';
import { LogoutButton } from '@/components/ui/logout-button';
import { updateLosPassword } from '@/lib/api';
import { LOS_STORAGE_KEY, LOS_THEME_KEY } from '@/lib/auth';

type SessionUser = {
  user?: { fullName?: string; email?: string; role?: string; roleName?: string };
};

type SidebarMode = 'expanded' | 'icons' | 'hidden';
type ThemeMode = 'light' | 'dark';
type NavIcon = 'dashboard' | 'leads' | 'applications' | 'agents' | 'roles' | 'masters' | 'eligibility' | 'partners';
type NavChildItem = { href: string; label: string };
type NavItem = { href: string; label: string; icon: NavIcon; badge?: number; children?: NavChildItem[] };
type NotificationItem = { title: string; detail: string; time: string; tone: 'lead' | 'disbursal' | 'payment' | 'risk' };

const SIDEBAR_MODE_KEY = 'moneycash_los_sidebar_mode';
const LEGACY_SIDEBAR_COLLAPSED_KEY = 'moneycash_los_sidebar_collapsed';

const eligibilityNavChildren: NavChildItem[] = ELIGIBILITY_SECTION_DEFINITIONS.map((item) => ({
  href: item.href,
  label: item.label,
}));

const navGroups: { section: string; color: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    color: '#1496f3',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' }],
  },
  {
    section: 'Loan Pipeline',
    color: '#6366f1',
    items: [
      { href: '/leads', label: 'Leads', icon: 'leads' },
      { href: '/applications', label: 'Applications', icon: 'applications' },
    ],
  },
  {
    section: 'Team',
    color: '#0d9488',
    items: [
      { href: '/agents', label: 'Agents', icon: 'agents' },
      { href: '/roles', label: 'Roles & Access', icon: 'roles' },
    ],
  },
  {
    section: 'Configuration',
    color: '#f59e0b',
    items: [
      { href: '/masters', label: 'Masters', icon: 'masters' },
      { href: '/eligibility-criteria', label: 'Business Rule Engine', icon: 'eligibility'},
    ],
  },
];

const notifications: NotificationItem[] = [
  { title: 'New lead assigned', detail: 'Ramesh Verma requested a 90-day business loan for inventory.', time: '2m ago', tone: 'lead' },
  { title: 'Loan disbursed', detail: 'INR 1.8L released to BlueKart Traders after e-sign completion.', time: '11m ago', tone: 'disbursal' },
  { title: 'Payment received', detail: 'ACH debit of INR 24,600 settled for borrower MC-2041.', time: '26m ago', tone: 'payment' },
  { title: 'Risk follow-up', detail: 'Bank statement parser flagged bounce activity on 2 merchant files.', time: '48m ago', tone: 'risk' },
];

const GROUP_ACCENT: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  'Overview':      { dot: 'bg-brand-blue',  bg: 'rgba(20,150,243,0.07)',  border: 'rgba(20,150,243,0.18)',  text: '#1496f3' },
  'Loan Pipeline': { dot: 'bg-indigo-500',  bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.18)', text: '#6366f1' },
  'Team':          { dot: 'bg-teal-600',    bg: 'rgba(13,148,136,0.07)', border: 'rgba(13,148,136,0.18)', text: '#0d9488' },
  'Configuration': { dot: 'bg-amber-400',  bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',  text: '#d97706' },
};

const toneColors: Record<NotificationItem['tone'], string> = {
  lead: 'bg-brand-blue',
  disbursal: 'bg-brand-success',
  payment: 'bg-brand-gold',
  risk: 'bg-brand-navy',
};

const BREADCRUMBS: Record<string, string> = {
  '/dashboard': 'LOS Dashboard',
  '/leads': 'Lead Management',
  '/applications': 'Application Management',
  '/partners': 'Partners',
  '/agents': 'Agent Management',
  '/roles': 'Role Management',
  '/masters': 'Masters',
  '/eligibility-criteria': 'Eligibility Criteria',
  ...Object.fromEntries(ELIGIBILITY_SECTION_DEFINITIONS.map((item) => [item.href, item.label])),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function persistSidebarMode(mode: SidebarMode) {
  window.localStorage.setItem(SIDEBAR_MODE_KEY, JSON.stringify({ mode }));
  window.localStorage.removeItem(LEGACY_SIDEBAR_COLLAPSED_KEY);
}

function isNavActive(pathname: string, item: NavItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function breadcrumbLabel(pathname: string): string {
  if (BREADCRUMBS[pathname]) return BREADCRUMBS[pathname];
  if (/^\/leads\/[^/]+$/.test(pathname)) return 'Lead detail';
  const seg = pathname.replace(/^\//, '').split('/')[0];
  return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : 'Home';
}

function canStartTrackedNavigation(event: ReactMouseEvent<HTMLDivElement>, anchor: HTMLAnchorElement) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  return true;
}

function navigationLabel(href: URL) {
  return breadcrumbLabel(href.pathname);
}

/**
 * Renders the brand logo only after mount so the server HTML matches the client's
 * first paint. Some browser extensions inject nodes next to <img> (e.g. #imgData),
 * which would otherwise cause a hydration mismatch with next/image.
 */
function MoneyCashSidebarLogo({ isIcons }: { isIcons: boolean }) {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cx(
          'rounded-[4px] bg-[rgba(23,44,113,0.07)]',
          isIcons ? 'mx-auto aspect-square w-9' : 'aspect-[540/168] w-[min(190px,100%)] max-w-full',
        )}
        aria-hidden
      />
    );
  }

  return (
    <Image
      src="/images/moneycash-logo.jpeg"
      alt="MoneyCash"
      width={540}
      height={168}
      sizes="190px"
      className={cx('h-auto block', isIcons ? 'w-9' : 'w-[min(190px,100%)]')}
      priority
    />
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

type SvgProps = { size?: number; className?: string };

function Icon({ size = 18, className = '', children }: SvgProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

function IcDashboard(p: SvgProps) {
  return <Icon {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="15" width="7" height="6" rx="1.5" /></Icon>;
}
function IcLeads(p: SvgProps) {
  return <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="16" y1="11" x2="22" y2="11" /></Icon>;
}
function IcApplications(p: SvgProps) {
  return <Icon {...p}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m9 12 2 2 4-4" /></Icon>;
}
function IcAgents(p: SvgProps) {
  return <Icon {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
}
function IcRoles(p: SvgProps) {
  return <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" /></Icon>;
}
function IcMasters(p: SvgProps) {
  return <Icon {...p}><line x1="4" y1="6" x2="8" y2="6" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="4" y1="14" x2="20" y2="14" /><line x1="4" y1="18" x2="16" y2="18" /><circle cx="18" cy="6" r="3" /></Icon>;
}
function IcEligibility(p: SvgProps) {
  return <Icon {...p}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Icon>;
}
function IcPartners(p: SvgProps) {
  return <Icon {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>;
}

function NavIconSvg({ name, size = 18 }: { name: NavIcon; size?: number }) {
  const p = { size };
  switch (name) {
    case 'dashboard':    return <IcDashboard {...p} />;
    case 'leads':        return <IcLeads {...p} />;
    case 'applications': return <IcApplications {...p} />;
    case 'agents':       return <IcAgents {...p} />;
    case 'roles':        return <IcRoles {...p} />;
    case 'masters':      return <IcMasters {...p} />;
    case 'eligibility':  return <IcEligibility {...p} />;
    case 'partners':     return <IcPartners {...p} />;
  }
}

const iSvg = { width: 18, height: 18, viewBox: '0 0 24 24' as const, fill: 'none' as const, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function ToggleIcon({ mode }: { mode: 'menu' | 'collapse' | 'expand' }) {
  if (mode === 'menu')     return <svg {...iSvg} aria-hidden><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>;
  if (mode === 'collapse') return <svg {...iSvg} aria-hidden><polyline points="15 18 9 12 15 6" /><polyline points="21 18 15 12 21 6" /></svg>;
  return                          <svg {...iSvg} aria-hidden><polyline points="9 18 15 12 9 6" /><polyline points="3 18 9 12 3 6" /></svg>;
}
function HideStageIcon() { return <svg {...iSvg} aria-hidden><rect x="4" y="4" width="12" height="16" rx="2" /><line x1="20" y1="8" x2="20" y2="16" /><polyline points="17 11 20 12 17 13" /></svg>; }
function ShowStageIcon() { return <svg {...iSvg} aria-hidden><rect x="4" y="4" width="12" height="16" rx="2" /><line x1="4" y1="8" x2="4" y2="16" /><polyline points="7 11 4 12 7 13" /></svg>; }
function NotificationIcon() { return <svg {...iSvg} aria-hidden><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.66V4a2 2 0 0 0-4 0v1.34A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5" /><path d="M10 17a2 2 0 0 0 4 0" /></svg>; }

// ── Shell ─────────────────────────────────────────────────────────────────────

export function CrmShell({
  title,
  subtitle,
  showPageHead = true,
  children,
}: {
  title?: string;
  subtitle?: string;
  showPageHead?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { isNavigating, startNavigation } = useNavigationProgress();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('expanded');
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const crumb = breadcrumbLabel(pathname);

  // Load session + sidebar mode from localStorage on mount
  useEffect(() => {
    const raw = window.localStorage.getItem(LOS_STORAGE_KEY);
    if (raw) {
      try { setSession(JSON.parse(raw) as SessionUser); } catch { /* ignore */ }
    }

    const stored = window.localStorage.getItem(SIDEBAR_MODE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { mode?: string };
        if (parsed.mode === 'expanded' || parsed.mode === 'icons' || parsed.mode === 'hidden') {
          setSidebarMode(parsed.mode);
          return;
        }
      } catch { /* fall through */ }
    }
    if (window.localStorage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY) === '1') setSidebarMode('hidden');
    const storedTheme = window.localStorage.getItem(LOS_THEME_KEY);
    const mode: ThemeMode = storedTheme === 'dark' ? 'dark' : 'light';
    setThemeMode(mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, []);

  // Responsive breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 960px)');
    function update() { setIsMobileLayout(mq.matches); }
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Close panels on route change
  useEffect(() => { setSidebarOpen(false); setNotificationsOpen(false); }, [pathname]);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  // Mobile body scroll lock
  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sidebarOpen]);

  // Dismiss notifications on outside click / Escape — only wired when open
  useEffect(() => {
    if (!notificationsOpen) return;
    function onDown(e: MouseEvent) {
      if (!notificationRef.current?.contains(e.target as Node)) setNotificationsOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNotificationsOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  function handleRailToggle() {
    if (sidebarMode === 'hidden') return;
    setSidebarMode((cur) => { const next: SidebarMode = cur === 'expanded' ? 'icons' : 'expanded'; persistSidebarMode(next); return next; });
  }
  function handleHideToggle() {
    setSidebarMode((cur) => { const next: SidebarMode = cur === 'hidden' ? 'icons' : 'hidden'; persistSidebarMode(next); return next; });
  }

  function applyTheme(next: ThemeMode) {
    setThemeMode(next);
    window.localStorage.setItem(LOS_THEME_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    const raw = window.localStorage.getItem(LOS_STORAGE_KEY);
    const token = raw ? (JSON.parse(raw) as { token?: string }).token : null;
    if (!token) {
      setPasswordError('Session expired - please login again.');
      return;
    }

    setPasswordSaving(true);
    try {
      await updateLosPassword(token, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password updated successfully.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Unable to update password.');
    } finally {
      setPasswordSaving(false);
    }
  }

  function handleLinkCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (isNavigating) return;
    if (!(event.target instanceof Element)) return;

    const anchor = event.target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (!canStartTrackedNavigation(event, anchor)) return;

    const rawHref = anchor.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#')) return;

    let nextUrl: URL;
    try {
      nextUrl = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }

    const currentUrl = new URL(window.location.href);
    if (nextUrl.origin !== currentUrl.origin) return;
    if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search && nextUrl.hash === currentUrl.hash) return;

    startNavigation({
      href: `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
      label: navigationLabel(nextUrl),
    });
  }

  const isIcons  = !isMobileLayout && sidebarMode === 'icons';
  const isHidden = !isMobileLayout && sidebarMode === 'hidden';
  const activeGroup = navGroups.find((g) => g.items.some((i) => isNavActive(pathname, i)));

  const sidebarWrapClass = cx(
    'transition-all duration-[200ms]',
    isMobileLayout
      ? cx('fixed inset-y-0 left-0 z-50 p-3', sidebarOpen ? 'translate-x-0' : '-translate-x-[110%]', 'w-[min(280px,88vw)] min-w-[min(280px,88vw)]')
      : isHidden ? 'w-0 min-w-0 p-0 opacity-0 overflow-hidden pointer-events-none'
      : isIcons  ? 'relative z-50 w-[72px] min-w-[72px] p-2'
      :            'relative z-50 w-[248px] min-w-[248px] p-2',
  );

  const toolBtn = 'inline-flex items-center justify-center w-8 h-8 border border-[rgba(23,44,113,0.12)] rounded-[8px] bg-[rgba(255,255,255,0.9)] text-brand-navy cursor-pointer transition-all duration-[140ms] hover:border-[rgba(20,150,243,0.28)] hover:bg-white hover:text-brand-blue disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      onClickCapture={handleLinkCapture}
      className={cx('min-h-screen flex items-stretch text-brand-text', isMobileLayout && 'block')}
      style={{ background: 'var(--los-bg)' }}
    >
      {isMobileLayout && sidebarOpen && (
        <button type="button" className="fixed inset-0 z-40 border-0 bg-[rgba(10,28,66,0.3)] backdrop-blur-[2px]" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside id="crm-sidebar-panel" className={sidebarWrapClass} aria-label="Main navigation">
        <div
          className={cx('sticky top-2 flex flex-col gap-2 min-h-[calc(100vh-16px)] max-h-[calc(100vh-16px)] rounded-[18px] border border-[rgba(23,44,113,0.1)] overflow-auto scrollbar-thin', isIcons ? 'p-2 items-center' : 'p-3')}
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(237,244,255,0.95) 100%)', boxShadow: '0 4px 24px rgba(23,44,113,0.1), inset 0 1px 0 rgba(255,255,255,0.9)' }}
        >
          {/* Brand */}
          <div className={cx('flex flex-col gap-2', isIcons && 'items-center')}>
            <Link href="/dashboard" className="block">
              <div className={cx('flex items-center justify-center border border-[rgba(18,36,79,0.09)] bg-white rounded-[12px] overflow-hidden transition-all duration-[120ms] hover:border-[rgba(20,150,243,0.22)] hover:shadow-[0_4px_14px_rgba(20,150,243,0.1)]', isIcons ? 'p-2' : 'p-2.5')}>
                <MoneyCashSidebarLogo isIcons={isIcons} />
              </div>
            </Link>
            
          </div>

          {/* Nav groups */}
          <nav className="flex flex-col gap-3" aria-label="Primary navigation">
            {navGroups.map((group) => {
              const accent = GROUP_ACCENT[group.section] ?? GROUP_ACCENT['Overview'];
              return (
                <div key={group.section}>
                  {!isIcons && (
                    <div className="flex items-center gap-2 px-2 mb-1">
                      <span className={cx('w-[5px] h-[5px] flex-shrink-0 rounded-full', accent.dot)} aria-hidden />
                      <span className="text-[0.64rem] font-extrabold tracking-[0.14em] uppercase" style={{ color: accent.text }}>{group.section}</span>
                      <span className="flex-1 h-px bg-[rgba(23,44,113,0.07)]" aria-hidden />
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = isNavActive(pathname, item);
                      const hasActiveChild = item.children?.some((child) => pathname === child.href) ?? false;
                      const showExpandedChildren = !isIcons && active && item.children?.length;
                      const navChildren = item.children ?? [];
                      const parentActive = active && !hasActiveChild;
                      const parentExpanded = hasActiveChild && !parentActive;
                      return (
                        <div key={item.href} className="flex flex-col gap-1">
                          <Link
                            href={item.href}
                            title={item.label}
                            aria-current={parentActive ? 'page' : undefined}
                            className={cx(
                              'group relative flex items-center gap-2.5 rounded-[10px] font-semibold text-[0.875rem] transition-all duration-[140ms] outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
                              isIcons ? 'justify-center p-2.5' : 'px-3 py-2',
                              parentActive
                                ? 'text-brand-navy shadow-[0_2px_8px_rgba(23,44,113,0.08)]'
                                : parentExpanded
                                  ? 'text-brand-navy'
                                  : 'text-brand-muted hover:text-brand-navy',
                            )}
                            style={
                              parentActive
                                ? { background: `linear-gradient(135deg, ${accent.bg}, rgba(255,255,255,0.5))`, border: `1px solid ${accent.border}` }
                                : parentExpanded
                                  ? { background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,255,0.96))', border: `1px solid ${accent.border}` }
                                  : { border: '1px solid transparent' }
                            }
                          >
                            {parentActive && !isIcons && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-full" style={{ background: accent.text }} aria-hidden />
                            )}
                            <span
                              className={cx(
                                'flex-shrink-0 flex items-center justify-center rounded-[8px] transition-all duration-[140ms]',
                                isIcons ? 'w-8 h-8' : 'w-7 h-7',
                                parentActive
                                  ? 'shadow-[0_2px_6px_rgba(23,44,113,0.12)]'
                                  : parentExpanded
                                    ? 'bg-[rgba(245,158,11,0.12)]'
                                    : 'bg-[rgba(23,44,113,0.05)] group-hover:bg-[rgba(23,44,113,0.08)]',
                              )}
                              style={parentActive ? { background: accent.text, color: '#fff' } : parentExpanded ? { color: accent.text } : undefined}
                              aria-hidden
                            >
                              <NavIconSvg name={item.icon} size={isIcons ? 18 : 16} />
                            </span>
                            {!isIcons && (
                              <>
                                <span className="flex-1 truncate">{item.label}</span>
                                {item.badge && (
                                  <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-blue text-white text-[0.65rem] font-extrabold">{item.badge}</span>
                                )}
                              </>
                            )}
                          </Link>

                          {showExpandedChildren ? (
                            <div
                              className="ml-3 grid gap-1 rounded-[12px] border px-2 py-2"
                              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.76), rgba(248,250,255,0.92))', borderColor: accent.border }}
                            >
                              {navChildren.map((child) => {
                                const childActive = pathname === child.href;
                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    aria-current={childActive ? 'page' : undefined}
                                    className={cx(
                                      'flex items-start gap-2 rounded-[9px] px-2.5 py-2 text-[0.75rem] font-semibold leading-[1.25] transition-colors',
                                      childActive
                                        ? 'border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.12)] text-brand-navy shadow-[0_1px_4px_rgba(23,44,113,0.06)]'
                                        : 'border border-transparent text-brand-muted hover:border-[rgba(23,44,113,0.08)] hover:bg-[rgba(255,255,255,0.74)] hover:text-brand-navy',
                                    )}
                                  >
                                    <span
                                      className={cx(
                                        'mt-[2px] h-[18px] w-[3px] flex-shrink-0 rounded-full',
                                        childActive ? 'bg-amber-500' : 'bg-[rgba(23,44,113,0.12)]',
                                      )}
                                      aria-hidden
                                    />
                                    <span className="min-w-0">{child.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          {!isIcons && (
            <div className="mt-auto pt-2 border-t border-[rgba(23,44,113,0.08)]">
              <div className="flex items-center gap-2 px-2 py-2 rounded-[10px] bg-[rgba(23,44,113,0.03)]">
                <span className="flex-shrink-0 grid place-items-center w-7 h-7 rounded-[8px] bg-[linear-gradient(145deg,#1496f3,#172c71)] text-white text-[0.75rem] font-extrabold">
                  {(session?.user?.fullName ?? 'M').slice(0, 1).toUpperCase()}
                </span>
                <span className="flex flex-col min-w-0 flex-1">
                  <strong className="text-[0.8rem] truncate leading-tight text-brand-navy">{session?.user?.fullName ?? 'MoneyCash Ops'}</strong>
                  <span className="text-[0.68rem] text-brand-muted truncate leading-tight">{session?.user?.roleName ?? session?.user?.role ?? 'LOS'}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className={cx('flex-1 min-w-0 flex flex-col', isMobileLayout ? 'p-3' : isHidden ? 'p-3' : 'p-[10px_14px_16px_0]')}>

        <header className={cx('sticky z-20 grid gap-2', isMobileLayout ? 'top-3' : 'top-0')}>
          {/* Top bar */}
          <div
            className={cx('rounded-[12px] border border-[rgba(23,44,113,0.1)] shadow-[0_2px_10px_rgba(23,44,113,0.06)] flex items-center justify-between gap-3 px-3 py-2', isMobileLayout && 'flex-col items-start')}
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(239,247,255,0.97))' }}
          >
            {/* Left */}
            <div className={cx('flex items-center gap-2.5 min-w-0', isMobileLayout && 'w-full justify-between flex-1')}>
              {isMobileLayout ? (
                <button type="button" className={toolBtn} aria-expanded={sidebarOpen} aria-controls="crm-sidebar-panel" onClick={() => setSidebarOpen((o) => !o)}>
                  <span className="inline-flex" aria-hidden><ToggleIcon mode="menu" /></span>
                  <span className="sr-only">{sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-1" role="toolbar" aria-label="Sidebar display">
                  <button type="button" className={toolBtn} disabled={sidebarMode === 'hidden'} aria-pressed={sidebarMode === 'icons'} onClick={handleRailToggle} title={sidebarMode === 'hidden' ? 'Show the sidebar first' : sidebarMode === 'icons' ? 'Expand sidebar' : 'Compact sidebar'}>
                    <span className="inline-flex" aria-hidden>{sidebarMode === 'expanded' ? <ToggleIcon mode="collapse" /> : <ToggleIcon mode="expand" />}</span>
                    <span className="sr-only">{sidebarMode === 'icons' ? 'Expand sidebar' : 'Compact sidebar'}</span>
                  </button>
                  <button type="button" className={cx(toolBtn, 'bg-[rgba(255,197,25,0.1)] border-[rgba(255,197,25,0.22)]')} aria-pressed={sidebarMode === 'hidden'} onClick={handleHideToggle} title={sidebarMode === 'hidden' ? 'Show sidebar as icon rail' : 'Hide sidebar'}>
                    <span className="inline-flex" aria-hidden>{sidebarMode === 'hidden' ? <ShowStageIcon /> : <HideStageIcon />}</span>
                    <span className="sr-only">{sidebarMode === 'hidden' ? 'Show sidebar' : 'Hide sidebar'}</span>
                  </button>
                </div>
              )}

              <nav className="flex items-center gap-1.5 min-w-0 text-[0.84rem]" aria-label="Breadcrumb">
                <Link href="/dashboard" className="font-semibold text-brand-muted hover:text-brand-navy transition-colors">Home</Link>
                <span className="text-[rgba(94,103,130,0.5)]" aria-hidden>/</span>
                <span className="font-bold text-brand-navy truncate">{crumb}</span>
              </nav>
            </div>

            {/* Right */}
            <div className={cx('flex items-center gap-2', isMobileLayout && 'w-full flex-wrap justify-start')}>
              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  className="relative inline-flex items-center gap-1.5 px-3 py-1.5 border border-[rgba(23,44,113,0.12)] rounded-[9px] bg-[rgba(255,255,255,0.9)] text-brand-navy cursor-pointer transition-all duration-[120ms] hover:border-[rgba(20,150,243,0.24)] hover:bg-white text-[0.82rem] font-semibold"
                  aria-expanded={notificationsOpen}
                  aria-haspopup="dialog"
                  onClick={() => setNotificationsOpen((o) => !o)}
                >
                  <span className="inline-flex" aria-hidden><NotificationIcon /></span>
                  <span>Alerts</span>
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-blue text-white text-[0.62rem] font-black">{notifications.length}</span>
                </button>

                {notificationsOpen && (
                  <div
                    className={cx('absolute top-[calc(100%+8px)] w-[min(380px,calc(100vw-24px))] flex flex-col gap-3 p-4 rounded-[14px] border border-[rgba(23,44,113,0.12)] shadow-[0_12px_36px_rgba(23,44,113,0.14)] z-50', isMobileLayout ? 'left-0' : 'right-0')}
                    style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(239,247,255,0.97))' }}
                    role="dialog"
                    aria-label="Notifications"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-[0.9rem] text-brand-navy">Live LOS alerts</strong>
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-brand-blue text-white text-[0.68rem] font-extrabold">{notifications.length} new</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {notifications.map((item) => (
                        <article key={`${item.title}-${item.time}`} className="flex flex-col gap-1 p-3 rounded-[9px] border border-[rgba(23,44,113,0.07)] bg-[rgba(255,255,255,0.9)]">
                          <div className="flex items-center gap-2">
                            <span className={cx('w-[7px] h-[7px] flex-shrink-0 rounded-full', toneColors[item.tone])} />
                            <strong className="text-[0.87rem] flex-1 min-w-0 truncate text-brand-navy">{item.title}</strong>
                            <span className="text-[0.74rem] font-semibold text-brand-muted flex-shrink-0">{item.time}</span>
                          </div>
                          <p className="m-0 text-brand-muted leading-[1.4] text-[0.8rem] pl-[15px]">{item.detail}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 min-w-0 px-2 py-1.5 rounded-[9px] bg-[rgba(255,255,255,0.88)] border border-[rgba(23,44,113,0.09)] cursor-pointer"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                >
                  <span className="flex-shrink-0 grid place-items-center w-7 h-7 rounded-[7px] bg-[linear-gradient(145deg,#1496f3,#172c71)] text-white text-[0.72rem] font-extrabold" aria-hidden>
                    {(session?.user?.fullName ?? 'M').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex flex-col min-w-0 text-left">
                    <strong className="text-[0.84rem] truncate leading-tight text-brand-navy">{session?.user?.fullName ?? 'MoneyCash Ops'}</strong>
                    <span className="text-[0.71rem] text-brand-muted truncate leading-tight">{session?.user?.roleName ?? session?.user?.role ?? 'LOS'}</span>
                  </span>
                </button>

                {userMenuOpen && (
                  <div
                    className={cx('absolute top-[calc(100%+8px)] w-[260px] rounded-[12px] border border-[rgba(23,44,113,0.12)] p-2 shadow-[0_12px_36px_rgba(23,44,113,0.14)] z-50 bg-white', isMobileLayout ? 'left-0' : 'right-0')}
                    role="menu"
                  >
                    <button
                      type="button"
                      className="w-full text-left min-h-[34px] px-3 rounded-[8px] hover:bg-[rgba(20,150,243,0.08)] text-[0.84rem] font-semibold text-brand-navy cursor-pointer"
                      onClick={() => {
                        setShowPasswordModal(true);
                        setUserMenuOpen(false);
                        setPasswordError(null);
                        setPasswordSuccess(null);
                      }}
                    >
                      Update password
                    </button>
                    <div className="mt-1 border-t border-[rgba(23,44,113,0.08)] pt-2 px-2">
                      <p className="m-0 text-[0.72rem] uppercase tracking-[0.08em] text-brand-muted font-extrabold">Theme</p>
                      <div className="mt-1 flex gap-2">
                        <button
                          type="button"
                          className={cx('min-h-[30px] px-3 rounded-[999px] border text-[0.78rem] font-bold cursor-pointer', themeMode === 'light' ? 'border-brand-blue text-brand-blue bg-[rgba(20,150,243,0.08)]' : 'border-[rgba(23,44,113,0.12)] text-brand-muted bg-white')}
                          onClick={() => applyTheme('light')}
                        >
                          Light
                        </button>
                        <button
                          type="button"
                          className={cx('min-h-[30px] px-3 rounded-[999px] border text-[0.78rem] font-bold cursor-pointer', themeMode === 'dark' ? 'border-brand-blue text-brand-blue bg-[rgba(20,150,243,0.08)]' : 'border-[rgba(23,44,113,0.12)] text-brand-muted bg-white')}
                          onClick={() => applyTheme('dark')}
                        >
                          Dark
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <LogoutButton className={cx('los-btn-primary', isMobileLayout && 'w-full')} />
            </div>
          </div>

          {/* Page head */}
          {showPageHead && (
            <div
              className="flex items-center gap-4 px-4 py-3 rounded-[12px] border border-[rgba(23,44,113,0.09)] shadow-[0_2px_8px_rgba(23,44,113,0.05)]"
              style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(239,247,255,0.96))' }}
            >
              {activeGroup && (
                <span className="flex-shrink-0 w-[3px] h-8 rounded-full" style={{ background: activeGroup.color }} aria-hidden />
              )}
              <div className="min-w-0">
                <span className="block text-[0.68rem] font-extrabold tracking-[0.16em] uppercase text-brand-blue leading-none mb-0.5">MoneyCash LOS</span>
                <h1 className="m-0 text-brand-text text-[1.5rem] leading-tight tracking-[-0.03em] font-extrabold">{title}</h1>
                {subtitle ? (
                  <p className="m-0 mt-1 max-w-[72ch] text-[0.84rem] leading-[1.45] text-brand-muted">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </header>

        <main className="pt-3">{children}</main>
      </div>

      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,28,66,0.42)] p-4 backdrop-blur-[4px]"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowPasswordModal(false);
          }}
        >
          <div className="w-full max-w-[460px] rounded-[16px] border border-[rgba(23,44,113,0.12)] bg-white p-5 shadow-[0_20px_56px_rgba(23,44,113,0.22)]">
            <h3 className="m-0 text-[1.1rem] font-extrabold text-brand-navy">Update Password</h3>
            <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">Use your current password to set a new one.</p>
            <form className="mt-3 grid gap-2" onSubmit={(e) => void handlePasswordSubmit(e)}>
              <input
                type="password"
                className="los-input"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <input
                type="password"
                className="los-input"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <input
                type="password"
                className="los-input"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {passwordError ? <p className="m-0 text-[0.82rem] text-[#8d3434]">{passwordError}</p> : null}
              {passwordSuccess ? <p className="m-0 text-[0.82rem] text-[#166534]">{passwordSuccess}</p> : null}
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  className="min-h-[36px] flex-1 rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent font-bold text-brand-text cursor-pointer"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Close
                </button>
                <button type="submit" className="los-btn-primary flex-1" disabled={passwordSaving}>
                  {passwordSaving ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useNavigationProgress } from '@/components/ui/navigation-progress-provider';
import { LOS_COOKIE_NAME, LOS_STORAGE_KEY } from '@/lib/auth';

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();

  function handleLogout() {
    window.localStorage.removeItem(LOS_STORAGE_KEY);
    document.cookie = `${LOS_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
    startNavigation({ href: '/login', label: 'Sign In' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button type="button" className={className} onClick={handleLogout}>
      Logout
    </button>
  );
}

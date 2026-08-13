'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOS_COOKIE_NAME, LOS_STORAGE_KEY } from '@/lib/auth';
import { getLosClientApiBase } from '@/lib/api-env';
import { useNavigationProgress } from '@/components/ui/navigation-progress-provider';

const API_URL = getLosClientApiBase();

type LoginResponse = {
  token?: string;
  user?: {
    id?: string;
    fullName?: string;
    email?: string;
    role?: string | null;
    roleName?: string | null;
  };
  message?: string;
};

export function LoginForm() {
  const router = useRouter();
  const { startNavigation } = useNavigationProgress();
  const [email, setEmail] = useState('admin@moneycash.in');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setError(
          response.status === 404
            ? 'LOS API proxy returned 404. Recreate the los container (docker compose up -d --force-recreate los) and hard-refresh.'
            : `Unable to reach the backend (HTTP ${response.status}).`,
        );
        setLoading(false);
        return;
      }

      const data = await response.json() as LoginResponse;

      if (!response.ok) {
        setError(data.message ?? 'Login failed');
        setLoading(false);
        return;
      }

      const roleName = data.user?.roleName ?? data.user?.role ?? null;
      if (!roleName) {
        setError('This account does not have CRM access.');
        setLoading(false);
        return;
      }

      window.localStorage.setItem(
        LOS_STORAGE_KEY,
        JSON.stringify({
          ...data,
          user: data.user ? { ...data.user, role: roleName, roleName } : data.user
        })
      );
      document.cookie = `${LOS_COOKIE_NAME}=1; path=/; max-age=86400; samesite=lax`;
      startNavigation({ href: '/dashboard', label: 'LOS Dashboard' });
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Unable to reach the backend.');
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <label htmlFor="email" className="text-[0.92rem] font-bold text-brand-text">
          Email
        </label>
        <input
          id="email"
          className="los-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <label htmlFor="password" className="text-[0.92rem] font-bold text-brand-text">
          Password
        </label>
        <input
          id="password"
          className="los-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error ? (
        <div className="rounded-[18px] p-[14px_16px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] text-[#8d3434] text-[0.92rem]">
          {error}
        </div>
      ) : null}
      <button className="los-btn-primary" type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}

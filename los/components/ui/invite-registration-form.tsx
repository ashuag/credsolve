'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { acceptInvitation, getInvitationPreview, type LosInvitationPreview } from '@/lib/api';

type InviteRegistrationFormProps = {
  token: string;
};

type InvitationState = 'loading' | 'ready' | 'expired' | 'success';

function formatExpiry(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true,
  });
}

export function InviteRegistrationForm({ token }: InviteRegistrationFormProps) {
  const [state, setState] = useState<InvitationState>('loading');
  const [preview, setPreview] = useState<LosInvitationPreview | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setState('loading');
    setError(null);

    getInvitationPreview(token)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Password setup link has expired.');
        setState('expired');
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await acceptInvitation(token, { password });
      setSuccessMessage(response.message);
      setState('success');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password setup link has expired.';
      setError(message);
      setState('expired');
    } finally {
      setLoading(false);
    }
  }

  if (state === 'loading') {
    return <p className="m-0 text-[0.92rem] text-brand-muted">Checking your invitation…</p>;
  }

  if (state === 'expired') {
    return (
      <div className="grid gap-4">
        <div>
          <span className="block text-[0.68rem] font-extrabold tracking-[0.16em] uppercase text-brand-blue mb-1">
            Registration link
          </span>
          <h1 className="m-0 text-[1.9rem] font-extrabold leading-[1.02] tracking-[-0.05em]">
            Password link expired
          </h1>
        </div>
        <p className="m-0 text-[0.92rem] leading-[1.6] text-brand-muted">
          {error ?? 'This password setup link is no longer valid.'}
        </p>
        <p className="m-0 text-[0.9rem] leading-[1.6] text-brand-muted">
          Ask your MoneyCash admin to create a new invitation for this account.
        </p>
        <Link href="/login" className="los-btn-primary inline-flex items-center justify-center no-underline">
          Back to login
        </Link>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="grid gap-4">
        <div>
          <span className="block text-[0.68rem] font-extrabold tracking-[0.16em] uppercase text-brand-blue mb-1">
            Registration complete
          </span>
          <h1 className="m-0 text-[1.9rem] font-extrabold leading-[1.02] tracking-[-0.05em]">
            Password set
          </h1>
        </div>
        <p className="m-0 text-[0.92rem] leading-[1.6] text-brand-muted">
          {successMessage ?? 'Your password has been set successfully. You can now sign in to MoneyCash LOS.'}
        </p>
        <Link href="/login" className="los-btn-primary inline-flex items-center justify-center no-underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <div>
          <span className="block text-[0.68rem] font-extrabold tracking-[0.16em] uppercase text-brand-blue mb-1">
            Welcome to MoneyCash LOS
          </span>
          <h1 className="m-0 text-[1.9rem] font-extrabold leading-[1.02] tracking-[-0.05em]">
            Set your password
          </h1>
        </div>
        <p className="m-0 text-[0.92rem] leading-[1.6] text-brand-muted">
          Create your password to finish registering this LOS account.
        </p>
      </div>

      <div className="rounded-[18px] border border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.78)] p-4">
        <strong className="block text-[0.96rem]">{preview?.fullName}</strong>
        <span className="block mt-1 text-[0.84rem] text-brand-muted">{preview?.email}</span>
        <span className="block mt-1 text-[0.82rem] text-brand-muted">
          Role: {preview?.roleName ?? 'Pending'}
        </span>
        <span className="block mt-2 text-[0.8rem] text-brand-muted">
          Link expires on {preview ? formatExpiry(preview.expiresAt) : '—'}
        </span>
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <label htmlFor="password" className="text-[0.92rem] font-bold text-brand-text">
            New password
          </label>
          <input
            id="password"
            className="los-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="confirm-password" className="text-[0.92rem] font-bold text-brand-text">
            Confirm password
          </label>
          <input
            id="confirm-password"
            className="los-input"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={6}
            autoComplete="new-password"
            required
          />
        </div>

        {error ? (
          <div className="rounded-[18px] p-[14px_16px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] text-[#8d3434] text-[0.92rem]">
            {error}
          </div>
        ) : null}

        <button className="los-btn-primary" type="submit" disabled={loading}>
          {loading ? 'Saving password…' : 'Set password'}
        </button>
      </form>
    </div>
  );
}

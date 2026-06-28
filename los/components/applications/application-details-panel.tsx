'use client';

import Link from 'next/link';
import { ApplicationReviewDashboard } from '@/components/applications/review/application-review-dashboard';
import '@/components/applications/review/application-review.css';
import { getApplicationDetails, type LosApplicationDetails } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { useCallback, useEffect, useState } from 'react';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOS_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

export function ApplicationDetailsPanel({ applicationUuid }: { applicationUuid: string }) {
  const [row, setRow] = useState<LosApplicationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = getToken();
    if (!token) {
      setError('Session expired - please log in again.');
      setLoading(false);
      return;
    }

    try {
      const data = await getApplicationDetails(token, applicationUuid);
      setRow(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load application details.');
    } finally {
      setLoading(false);
    }
  }, [applicationUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="app-review ar-full-bleed" style={{ padding: '24px 0' }}>
        <div className="ar-wrap">
          <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 120, borderRadius: 14, background: 'var(--line-2, #eef2f8)' }} />
            <div style={{ height: 80, borderRadius: 14, background: 'var(--line-2, #eef2f8)' }} />
            <div style={{ height: 320, borderRadius: 14, background: 'var(--line-2, #eef2f8)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-review" style={{ padding: 24 }}>
        <div className="card" style={{ maxWidth: 560, margin: '0 auto', borderColor: 'var(--bad-line)', background: 'var(--bad-bg)' }}>
          <div className="card-b" style={{ color: 'var(--bad)' }}>
            <strong>Unable to load this application.</strong>
            <p style={{ margin: '8px 0 0' }}>{error}</p>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <Link href="/applications" className="navbtn">
                Back to applications
              </Link>
              <button type="button" className="navbtn btn-primary" onClick={() => void load()}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="app-review" style={{ padding: 24 }}>
        <p style={{ color: 'var(--ink-3)' }}>Application not found.</p>
        <Link href="/applications" className="navbtn" style={{ display: 'inline-flex', marginTop: 12 }}>
          Return to application queue
        </Link>
      </div>
    );
  }

  return (
    <ApplicationReviewDashboard
      row={row}
      applicationUuid={applicationUuid}
      authToken={getToken()}
      onRefresh={() => void load()}
    />
  );
}

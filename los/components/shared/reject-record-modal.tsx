'use client';

import { getMasters, rejectApplication, rejectLead } from '@/lib/api';
import { rejectionReasonDisplayLabel } from '@/lib/rejection-reason-label';
import { FormEvent, useEffect, useState } from 'react';

type RejectionReasonOption = { code: string; label: string };

export function RejectRecordModal({
  open,
  token,
  recordType,
  recordUuid,
  recordLabel,
  onClose,
  onSuccess,
}: {
  open: boolean;
  token: string | null;
  recordType: 'lead' | 'application';
  recordUuid: string;
  recordLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reasons, setReasons] = useState<RejectionReasonOption[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [reasonCode, setReasonCode] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setReasonCode('');
    setNotes('');
    setError(null);

    if (!token) {
      setReasons([]);
      return;
    }

    let cancelled = false;
    setLoadingReasons(true);

    void getMasters(token)
      .then((masters) => {
        if (cancelled) return;
        const options = (masters.rejectionReasons ?? [])
          .filter((item) => item.isActive)
          .map((item) => ({
            code: item.name,
            label: rejectionReasonDisplayLabel(item.name),
          }));
        setReasons(options);
        if (options.length > 0) {
          setReasonCode(options[0]!.code);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load rejection reasons.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingReasons(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose();
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, saving]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      setError('Session expired — please log in again.');
      return;
    }
    if (!reasonCode) {
      setError('Select a rejection reason.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        rejectionReasonCode: reasonCode,
        notes: notes.trim() || undefined,
      };

      if (recordType === 'lead') {
        await rejectLead(token, recordUuid, payload);
      } else {
        await rejectApplication(token, recordUuid, payload);
      }

      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save rejection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,28,66,0.42)] p-4 backdrop-blur-[4px]"
      onClick={(event) => {
        if (!saving && event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-record-title"
    >
      <div
        className="w-full max-w-[440px] rounded-[16px] border border-[rgba(15,39,72,0.12)] bg-white p-5 shadow-[0_20px_56px_rgba(15,39,72,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="reject-record-title" className="m-0 text-[1.05rem] font-extrabold text-brand-navy">
          Reject {recordType === 'lead' ? 'lead' : 'application'}
        </h2>
        <p className="m-0 mt-1 text-[0.82rem] leading-snug text-brand-muted">
          Set a rejection reason and optional note for <strong className="text-brand-text">{recordLabel}</strong>.
        </p>

        <form className="mt-4 grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
          <label className="grid gap-1.5">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-brand-muted">Rejection reason</span>
            <select
              className="los-input h-[40px] text-[0.86rem]"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              disabled={loadingReasons || saving || reasons.length === 0}
              required
            >
              {reasons.length === 0 ? (
                <option value="">{loadingReasons ? 'Loading reasons…' : 'No reasons configured'}</option>
              ) : (
                reasons.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.label}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-brand-muted">Notes</span>
            <textarea
              className="los-input min-h-[96px] resize-y py-2.5 text-[0.86rem]"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={saving}
              maxLength={256}
              placeholder="Optional context for the ops team"
            />
          </label>

          {error ? (
            <p className="m-0 rounded-[8px] border border-[rgba(239,68,68,0.2)] bg-[rgba(254,242,242,0.9)] px-3 py-2 text-[0.8rem] text-[#b91c1c]">
              {error}
            </p>
          ) : null}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-[38px] rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-transparent px-4 text-[0.84rem] font-bold text-brand-text hover:bg-[rgba(34,197,94,0.06)] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loadingReasons || !reasonCode}
              className="h-[38px] rounded-[8px] border border-[rgba(239,68,68,0.35)] bg-[#ef4444] px-4 text-[0.84rem] font-bold text-white hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function canRejectLeadStatus(statusCode: string): boolean {
  const code = statusCode.toUpperCase();
  return code !== 'REJECTED' && code !== 'BLACKLISTED';
}

export function canRejectApplicationStatus(statusCode: string): boolean {
  const code = statusCode.toUpperCase();
  return !['REJECTED', 'KYC_FAILED', 'PENNYDROP_FAILED', 'CANCELLED', 'DISBURSED', 'ACTIVE'].includes(code);
}

export function canApproveApplicationStatus(statusCode: string): boolean {
  const code = statusCode.toUpperCase();
  return !['APPROVED', 'REJECTED', 'KYC_FAILED', 'PENNYDROP_FAILED', 'CANCELLED', 'DISBURSED', 'ACTIVE'].includes(code);
}

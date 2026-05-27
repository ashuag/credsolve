'use client';

import { downloadCibilReportPdf } from '@/lib/api';
import { FormEvent, useState } from 'react';
import { getLosToken } from '@/components/eligibility/eligibility-ui';

export function CibilReportDownloadPanel() {
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [lastFilename, setLastFilename] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setParseError(null);
    setRequestError(null);
    setLastFilename(null);

    let bureauPayload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setParseError('Bureau JSON must be a JSON object (Tenacio vendor response envelope).');
        return;
      }
      bureauPayload = parsed as Record<string, unknown>;
    } catch {
      setParseError('Invalid JSON. Paste the full bureau API response body.');
      return;
    }

    const token = getLosToken();
    if (!token) {
      setRequestError('Session expired. Sign in again.');
      return;
    }

    setLoading(true);
    try {
      const { blob, filename } = await downloadCibilReportPdf(token, { bureauPayload });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setLastFilename(filename);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'CIBIL report download failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Paste bureau JSON to generate and download a CIBIL-style summary PDF. The file is built in memory
        only — it is not uploaded to storage and no <code className="font-mono text-[0.8rem]">bureau_report</code>{' '}
        record is updated.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
          Bureau JSON
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={14}
            className="font-mono rounded-[12px] border border-[rgba(23,44,113,0.12)] bg-[rgba(248,250,255,0.9)] p-3 text-[0.78rem] leading-[1.45]"
            placeholder='{ "data": { "cibilData": { ... } } }'
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-fit cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
        >
          {loading ? 'Generating PDF…' : 'Download CIBIL report'}
        </button>
      </form>

      {parseError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{parseError}</p> : null}
      {requestError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{requestError}</p> : null}

      {lastFilename ? (
        <p className="m-0 rounded-[12px] border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)] p-3 text-[0.84rem] text-brand-navy">
          Downloaded <span className="font-mono font-semibold">{lastFilename}</span>. Nothing was saved on the
          server.
        </p>
      ) : null}
    </div>
  );
}

'use client';

import { PostBreResultsSummary } from '@/components/eligibility/post-bureau-bre-panel';
import { getLosToken } from '@/components/eligibility/eligibility-ui';
import { runPostBureauBreCheckFromHtml, type PostBreFromHtmlResult } from '@/lib/api';
import { ChangeEvent, FormEvent, useRef, useState } from 'react';

export function PostBreHtmlPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [htmlText, setHtmlText] = useState('');
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [applicantMobile, setApplicantMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PostBreFromHtmlResult | null>(null);
  const [showJson, setShowJson] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRequestError(null);
    setResult(null);

    if (!file) {
      setFilename(null);
      setHtmlText('');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      setRequestError('Please choose an .html or .htm CIBIL bureau report.');
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      setFilename(file.name);
      setHtmlText(text);
    } catch {
      setRequestError('Could not read the selected file.');
      setFilename(null);
      setHtmlText('');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setRequestError(null);
    setResult(null);

    if (!htmlText.trim()) {
      setRequestError('Upload a CIBIL bureau HTML report first.');
      return;
    }

    const token = getLosToken();
    if (!token) {
      setRequestError('Session expired. Sign in again.');
      return;
    }

    setLoading(true);
    try {
      const response = await runPostBureauBreCheckFromHtml(token, {
        html: htmlText,
        filename: filename ?? undefined,
        isExistingCustomer,
        applicantMobile: applicantMobile.trim() || null,
      });
      setResult(response);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Unable to run post-BRE check from HTML.');
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setFilename(null);
    setHtmlText('');
    setResult(null);
    setRequestError(null);
    setShowJson(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="grid gap-6">
      <form
        className="grid gap-4 rounded-2xl border border-[rgba(15,39,72,0.1)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_12px_40px_rgba(15,39,72,0.06)]"
        onSubmit={handleSubmit}
      >
        <div>
          <h2 className="m-0 text-[1.05rem] font-extrabold tracking-[-0.03em] text-brand-navy">
            CIBIL HTML report
          </h2>
          <p className="m-0 mt-1 text-[0.84rem] leading-[1.45] text-brand-muted">
            Upload a myscore.cibil.com / Tenacio HTML bureau export. The server converts it to vendor JSON
            and runs every post-BRE rule (same inspector as Post BRE Check).
          </p>
        </div>

        <label className="grid gap-1.5">
          <span className="text-[0.84rem] font-bold text-brand-muted">HTML file</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,text/html"
            className="los-input cursor-pointer py-2 text-[0.84rem]"
            onChange={handleFileChange}
          />
          {filename ? (
            <p className="m-0 text-[0.78rem] text-brand-muted">
              Selected: <span className="font-mono font-semibold text-brand-navy">{filename}</span>
              {htmlText ? ` · ${(htmlText.length / 1024).toFixed(1)} KB` : null}
            </p>
          ) : null}
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.84rem] font-bold text-brand-muted">
            Applicant mobile (optional — bureau phone match)
          </span>
          <input
            type="text"
            inputMode="tel"
            className="los-input font-mono text-[0.88rem]"
            value={applicantMobile}
            onChange={(event) => setApplicantMobile(event.target.value)}
            placeholder="9876543210"
            maxLength={20}
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-[0.88rem] font-semibold text-brand-navy">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-blue"
            checked={isExistingCustomer}
            onChange={(event) => setIsExistingCustomer(event.target.checked)}
          />
          Treat as recurring customer (existing CIBIL floor and rejected grades)
        </label>

        {requestError ? (
          <p className="m-0 rounded-[10px] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] px-3 py-2 text-[0.84rem] text-[#991b1b]">
            {requestError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="los-btn-primary min-h-10.5 px-5"
            disabled={loading || !htmlText.trim()}
          >
            {loading ? 'Parsing & running checks…' : 'Parse HTML and run post-BRE'}
          </button>
          <button
            type="button"
            className="min-h-10.5 cursor-pointer rounded-[10px] border border-[rgba(15,39,72,0.14)] bg-white px-5 text-[0.88rem] font-bold text-brand-navy transition-colors hover:border-[rgba(34,197,94,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      </form>

      {result?.conversion ? (
        <div className="rounded-[14px] border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.04)] px-4 py-3">
          <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
            HTML → JSON conversion
          </p>
          <p className="m-0 mt-1 text-[0.84rem] text-brand-navy">
            Source: <span className="font-mono font-semibold">{result.conversion.convertedFromHtml}</span>
            {' · '}
            {result.conversion.accountCount} account(s), {result.conversion.inquiryCount} enquiry(ies)
          </p>
          <button
            type="button"
            className="mt-2 cursor-pointer text-[0.8rem] font-bold text-brand-blue underline-offset-2 hover:underline"
            onClick={() => setShowJson((open) => !open)}
          >
            {showJson ? 'Hide' : 'Show'} converted bureau JSON
          </button>
          {showJson ? (
            <pre className="mt-2 max-h-96 overflow-auto rounded-[10px] border border-[rgba(15,39,72,0.08)] bg-white p-3 text-[0.72rem] leading-normal text-brand-muted">
              {JSON.stringify(result.bureauPayload, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}

      {result ? <PostBreResultsSummary result={result} /> : null}
    </div>
  );
}

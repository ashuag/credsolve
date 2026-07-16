'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loanDocumentPdfAbsoluteUrl } from '@/lib/api/loan-documents';

type LoanDocumentScrollPanelProps = {
  title: string;
  pdfUrlFragment: string;
  agreed: boolean;
  onAgreedChange: (next: boolean) => void;
};

function isMobilePdfHost(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iOS Safari/Chrome never render PDFs inside iframes; many Android WebViews are unreliable too.
  const ios = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  return ios || android;
}

export function LoanDocumentScrollPanel({
  title,
  pdfUrlFragment,
  agreed,
  onAgreedChange,
}: LoanDocumentScrollPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [openedExternally, setOpenedExternally] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  // Start false for SSR/hydration safety; flip to native viewer on mobile after mount.
  const [useNativeViewer, setUseNativeViewer] = useState(false);
  const onAgreedChangeRef = useRef(onAgreedChange);

  useEffect(() => {
    onAgreedChangeRef.current = onAgreedChange;
  }, [onAgreedChange]);

  useEffect(() => {
    if (isMobilePdfHost()) setUseNativeViewer(true);
  }, []);

  const pdfSrc = loanDocumentPdfAbsoluteUrl(pdfUrlFragment);
  const canContinue = scrolledToEnd || openedExternally;

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Short documents (or empty frames) still unlock after a full visible pass.
    if (el.scrollHeight <= el.clientHeight + 8) {
      setScrolledToEnd(true);
      return;
    }
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (atEnd) setScrolledToEnd(true);
  }, []);

  useEffect(() => {
    setScrolledToEnd(false);
    setOpenedExternally(false);
    setLoadError('');
    onAgreedChangeRef.current(false);

    if (!pdfSrc || useNativeViewer) {
      setBlobUrl(null);
      return;
    }

    let revoked: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(pdfSrc, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Unable to load PDF (${res.status}).`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setBlobUrl(url);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Unable to load PDF.');
          setUseNativeViewer(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [pdfSrc, useNativeViewer, pdfUrlFragment]);

  useEffect(() => {
    if (useNativeViewer) return;
    const t = window.setTimeout(checkScroll, 400);
    return () => window.clearTimeout(t);
  }, [blobUrl, checkScroll, useNativeViewer]);

  function handleOpenPdf() {
    setOpenedExternally(true);
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <a
        href={pdfSrc}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleOpenPdf}
        className="w-fit shrink-0 text-sm font-semibold text-brand-blue hover:underline"
      >
        Open PDF in new tab
      </a>

      {useNativeViewer ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
          <p className="max-w-sm text-sm font-medium leading-relaxed text-slate-600">
            Your mobile browser can&apos;t show this PDF inside the page. Open it in a new tab, read it fully, then
            return here to confirm.
          </p>
          {loadError ? <p className="text-xs font-semibold text-amber-700">{loadError}</p> : null}
          <a
            href={pdfSrc}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOpenPdf}
            className="mc-btn-primary inline-flex min-h-[48px] items-center justify-center px-6 py-3 text-sm"
          >
            View sanction letter PDF
          </a>
          {openedExternally ? (
            <p className="text-xs font-semibold text-emerald-700">Document opened — you can confirm below.</p>
          ) : (
            <p className="text-xs font-medium text-amber-700">Open the PDF to continue.</p>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="h-[min(52dvh,480px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white"
        >
          {blobUrl ? (
            <iframe
              title={title}
              src={`${blobUrl}#view=FitH`}
              className="block w-full border-0 bg-white"
              style={{ height: '4800px' }}
            />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center text-sm font-medium text-slate-500">
              Loading document…
            </div>
          )}
        </div>
      )}

      {!useNativeViewer && !scrolledToEnd ? (
        <p className="shrink-0 text-xs font-medium text-amber-700">Scroll to the bottom to continue.</p>
      ) : null}

      <label
        className={`flex shrink-0 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
          canContinue ? 'border-slate-200 bg-white' : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
        }`}
      >
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-brand-blue"
          disabled={!canContinue}
          checked={agreed}
          onChange={(e) => onAgreedChange(e.target.checked)}
        />
        <span className="text-sm leading-relaxed text-slate-700">
          I have read and understood the <strong>{title}</strong> and agree to its terms.
        </span>
      </label>
    </div>
  );
}

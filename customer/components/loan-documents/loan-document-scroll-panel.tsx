'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loanDocumentPdfAbsoluteUrl } from '@/lib/api/loan-documents';

type LoanDocumentScrollPanelProps = {
  title: string;
  pdfUrlFragment: string;
  onReadyChange: (ready: boolean) => void;
};

function isMobilePdfHost(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iOS Safari/Chrome never render PDFs inside iframes; many Android WebViews are unreliable too.
  const ios = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  return ios || android;
}

function DocumentGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        d="M7 3.5h7.2L19 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1.5-1.5Z"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h5" strokeLinejoin="round" />
      <path d="M9 12.5h6M9 16h4.5" strokeLinecap="round" />
    </svg>
  );
}

export function LoanDocumentScrollPanel({
  title,
  pdfUrlFragment,
  onReadyChange,
}: LoanDocumentScrollPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [openedExternally, setOpenedExternally] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  // Start false for SSR/hydration safety; flip to native viewer on mobile after mount.
  const [useNativeViewer, setUseNativeViewer] = useState(false);
  const onReadyChangeRef = useRef(onReadyChange);

  useEffect(() => {
    onReadyChangeRef.current = onReadyChange;
  }, [onReadyChange]);

  useEffect(() => {
    if (isMobilePdfHost()) setUseNativeViewer(true);
  }, []);

  const pdfSrc = loanDocumentPdfAbsoluteUrl(pdfUrlFragment);
  const canContinue = scrolledToEnd || openedExternally;

  useEffect(() => {
    onReadyChangeRef.current(canContinue);
  }, [canContinue]);

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
    onReadyChangeRef.current(false);

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
    <div className="flex flex-col gap-4">
      {!useNativeViewer ? (
        <a
          href={pdfSrc}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOpenPdf}
          className="w-fit shrink-0 text-sm font-semibold text-brand-blue hover:underline"
        >
          Open PDF in new tab
        </a>
      ) : null}

      {useNativeViewer ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(18,36,79,0.06)]">
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#1496f3]/10" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-28 w-28 rounded-full bg-[#ffc519]/15" aria-hidden />

          <div className="relative flex flex-col items-center px-5 py-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1496f3]/10 text-[#1496f3]">
              <DocumentGlyph />
            </div>
            <p className="m-0 mb-1 text-[0.98rem] font-extrabold leading-snug text-brand-navy">{title}</p>
            <p className="m-0 mb-5 max-w-sm text-sm font-medium leading-relaxed text-slate-500">
              Your Key Fact Statement opens in a new tab. Read it fully, then come back here to continue.
            </p>
            {loadError ? <p className="mb-3 text-xs font-semibold text-amber-700">{loadError}</p> : null}
            <a
              href={pdfSrc}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleOpenPdf}
              className="mc-btn-primary inline-flex min-h-[48px] w-full items-center justify-center px-6 py-3 text-sm"
            >
              {openedExternally ? 'Reopen sanction letter PDF' : 'View sanction letter PDF'}
            </a>
            {openedExternally ? (
              <p className="mt-3 mb-0 text-xs font-semibold text-emerald-700">
                Document opened — you can continue below.
              </p>
            ) : (
              <p className="mt-3 mb-0 text-xs font-medium text-amber-700">Open the PDF to continue.</p>
            )}
          </div>
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
    </div>
  );
}

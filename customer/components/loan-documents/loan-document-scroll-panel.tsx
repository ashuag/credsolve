'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loanDocumentHtmlAbsoluteUrl } from '@/lib/api/loan-documents';

type LoanDocumentScrollPanelProps = {
  title: string;
  pdfUrlFragment: string;
  htmlUrlFragment?: string;
  onReadyChange?: (ready: boolean) => void;
  onViewingChange?: (viewing: boolean) => void;
};

function isMobilePdfHost(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
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
  htmlUrlFragment,
  onReadyChange,
  onViewingChange,
}: LoanDocumentScrollPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endSentinelRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [hostReady, setHostReady] = useState(false);
  const [mobileViewerOpen, setMobileViewerOpen] = useState(false);
  const onReadyChangeRef = useRef(onReadyChange);

  useEffect(() => {
    onReadyChangeRef.current = onReadyChange;
  }, [onReadyChange]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setIsMobile(isMobilePdfHost() || mq.matches);
    apply();
    setHostReady(true);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const htmlSrc = loanDocumentHtmlAbsoluteUrl(
    htmlUrlFragment?.trim() || pdfUrlFragment.replace(/\/pdf\/?$/i, '/html'),
  );
  const showInlineViewer = hostReady && (!isMobile || mobileViewerOpen);
  const canContinue = scrolledToEnd;

  useEffect(() => {
    if (!hostReady) return;
    onViewingChange?.(showInlineViewer);
  }, [hostReady, showInlineViewer, onViewingChange]);

  useEffect(() => {
    onReadyChangeRef.current?.(canContinue);
  }, [canContinue]);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !html) return;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
    if (atEnd) setScrolledToEnd(true);
  }, [html]);

  useEffect(() => {
    setScrolledToEnd(false);
    setLoadError('');
    onReadyChangeRef.current?.(false);

    if (!htmlSrc || (isMobile && !mobileViewerOpen)) {
      setHtml(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(htmlSrc, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'text/html' },
          signal: AbortSignal.timeout(90_000),
        });
        if (!res.ok) {
          throw new Error(`Unable to load letter (${res.status}).`);
        }
        const text = await res.text();
        if (cancelled) return;
        if (!text.trim()) {
          throw new Error('The sanction letter is empty.');
        }
        setHtml(text);
      } catch (e) {
        if (!cancelled) {
          const timedOut =
            (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'TimeoutError') ||
            (e instanceof Error && e.name === 'TimeoutError');
          setLoadError(
            timedOut
              ? 'The sanction letter is taking too long to generate. Please retry.'
              : e instanceof Error
                ? e.message
                : 'Unable to load letter.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [htmlSrc, isMobile, mobileViewerOpen]);

  const fitIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body) return;
    const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 400);
    iframe.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    if (!html) return;
    const iframe = iframeRef.current;
    const t1 = window.setTimeout(fitIframeHeight, 50);
    const t2 = window.setTimeout(fitIframeHeight, 400);
    const t3 = window.setTimeout(fitIframeHeight, 1200);
    const onLoad = () => {
      fitIframeHeight();
      const doc = iframe?.contentDocument;
      if (!doc) return;
      doc.querySelectorAll('img').forEach((img) => {
        img.addEventListener('load', fitIframeHeight);
      });
      const scrolling = doc.scrollingElement ?? doc.documentElement;
      const onInnerScroll = () => {
        if (scrolling.scrollTop + scrolling.clientHeight >= scrolling.scrollHeight - 48) {
          setScrolledToEnd(true);
        }
      };
      doc.addEventListener('scroll', onInnerScroll, { passive: true });
    };
    iframe?.addEventListener('load', onLoad);
    return () => {
      iframe?.removeEventListener('load', onLoad);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [html, fitIframeHeight]);

  useEffect(() => {
    if (!html) return;
    const root = scrollRef.current;
    const sentinel = endSentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setScrolledToEnd(true);
        }
      },
      { root, threshold: 0.01 },
    );
    observer.observe(sentinel);
    const t = window.setTimeout(checkScroll, 400);
    return () => {
      observer.disconnect();
      window.clearTimeout(t);
    };
  }, [html, checkScroll]);

  return (
    <div className="flex flex-col gap-4">
      {isMobile && !mobileViewerOpen ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(18,36,79,0.06)]">
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#1496f3]/10" aria-hidden />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-28 w-28 rounded-full bg-[#22c55e]/15" aria-hidden />

          <div className="relative flex flex-col items-center px-5 py-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1496f3]/10 text-[#1496f3]">
              <DocumentGlyph />
            </div>
            <p className="m-0 mb-1 text-[0.98rem] font-extrabold leading-snug text-brand-navy">{title}</p>
            <p className="m-0 mb-5 max-w-sm text-sm font-medium leading-relaxed text-slate-500">
              Your Key Fact Statement opens on this page. Read it fully, then continue.
            </p>
            <button
              type="button"
              onClick={() => setMobileViewerOpen(true)}
              className="mc-btn-primary inline-flex min-h-[48px] w-full items-center justify-center px-6 py-3 text-sm"
            >
              View sanction letter
            </button>
            <p className="mt-3 mb-0 text-xs font-medium text-amber-700">Open the letter to continue.</p>
          </div>
        </div>
      ) : null}

      {showInlineViewer ? (
        <>
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="h-[min(72dvh,720px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white"
          >
            {html ? (
              <div className="relative bg-white">
                <iframe
                  ref={iframeRef}
                  title={title}
                  srcDoc={html}
                  sandbox="allow-same-origin"
                  className="block w-full border-0 bg-white"
                  style={{ minHeight: '480px' }}
                  onLoad={fitIframeHeight}
                />
                <div ref={endSentinelRef} className="h-10 w-full bg-white" aria-hidden />
              </div>
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm font-medium text-slate-500">
                {loadError || 'Preparing your sanction letter…'}
              </div>
            )}
          </div>
          {loadError ? <p className="text-xs font-semibold text-amber-700">{loadError}</p> : null}
        </>
      ) : null}
    </div>
  );
}

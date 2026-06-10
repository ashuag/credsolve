'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loanDocumentPdfAbsoluteUrl } from '@/lib/api/loan-documents';

type LoanDocumentScrollPanelProps = {
  title: string;
  pdfUrlFragment: string;
  agreed: boolean;
  onAgreedChange: (next: boolean) => void;
};

/** Tall iframe so the outer scroll container can scroll through every PDF page. */
const PDF_IFRAME_MIN_HEIGHT_PX = 4800;

export function LoanDocumentScrollPanel({
  title,
  pdfUrlFragment,
  agreed,
  onAgreedChange,
}: LoanDocumentScrollPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const onAgreedChangeRef = useRef(onAgreedChange);

  useEffect(() => {
    onAgreedChangeRef.current = onAgreedChange;
  }, [onAgreedChange]);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (atEnd) setScrolledToEnd(true);
  }, []);

  useEffect(() => {
    setScrolledToEnd(false);
    // Reset agreement only when the document changes; avoid callback identity loops.
    onAgreedChangeRef.current(false);
    const t = window.setTimeout(checkScroll, 400);
    return () => window.clearTimeout(t);
  }, [pdfUrlFragment, checkScroll]);

  const pdfSrc = loanDocumentPdfAbsoluteUrl(pdfUrlFragment);

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
      <a
        href={pdfSrc}
        target="_blank"
        rel="noopener noreferrer"
        className="w-fit shrink-0 text-sm font-semibold text-brand-blue hover:underline"
      >
        Open PDF in new tab
      </a>
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50"
      >
        <iframe
          title={title}
          src={pdfSrc}
          className="block w-full border-0 bg-white"
          style={{ minHeight: PDF_IFRAME_MIN_HEIGHT_PX }}
        />
      </div>
      {!scrolledToEnd ? (
        <p className="shrink-0 text-xs font-medium text-amber-700">Scroll to the bottom to continue.</p>
      ) : null}
      <label
        className={`flex shrink-0 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
          scrolledToEnd ? 'border-slate-200 bg-white' : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
        }`}
      >
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-brand-blue"
          disabled={!scrolledToEnd}
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

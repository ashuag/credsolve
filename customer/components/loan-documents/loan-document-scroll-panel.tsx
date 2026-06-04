'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loanDocumentPdfAbsoluteUrl } from '@/lib/api/loan-documents';

type LoanDocumentScrollPanelProps = {
  title: string;
  pdfUrlFragment: string;
  agreed: boolean;
  onAgreedChange: (next: boolean) => void;
};

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
    <div className="flex flex-col gap-4 h-full">
      <h2 className="text-lg font-bold text-brand-navy">{title}</h2>
      <p className="text-sm text-slate-500">
        Scroll through the entire document to enable &quot;I agree&quot;. You can also open it in a new tab if the
        preview is hard to read.
      </p>
      <a
        href={pdfSrc}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-brand-blue hover:underline w-fit"
      >
        Open PDF in new tab
      </a>
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex-1 min-h-100 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50"
      >
        <iframe
          title={title}
          src={pdfSrc}
          className="h-400 w-full min-h-full border-0 bg-white"
        />
      </div>
      {!scrolledToEnd ? (
        <p className="text-xs text-amber-700 font-medium">Scroll to the bottom to continue.</p>
      ) : null}
      <label
        className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
          scrolledToEnd ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
        }`}
      >
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-brand-blue"
          disabled={!scrolledToEnd}
          checked={agreed}
          onChange={(e) => onAgreedChange(e.target.checked)}
        />
        <span className="text-sm text-slate-700 leading-relaxed">
          I have read and understood the <strong>{title}</strong> and agree to its terms.
        </span>
      </label>
    </div>
  );
}

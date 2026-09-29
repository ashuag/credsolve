'use client';

import { getLosToken } from '@/lib/auth';
import { useCallback, useState } from 'react';

const DEFAULT_CLASS =
  'min-h-[32px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.06)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

export type DownloadDumpButtonProps = {
  /** Whether at least one filter is applied — the dump stays disabled until one is, to avoid an unbounded dump. */
  filtersActive: boolean;
  /** True while the list (or the debounced filters) hasn't settled yet — disables the button without changing its tooltip. */
  loading: boolean;
  /** Row count under the current filters; 0 disables the button with a "no records" tooltip. */
  resultCount: number;
  /** Called when there's no LOS token in storage (session expired) instead of starting the download. */
  onSessionExpired: () => void;
  /** Fetches the export with the token as a Bearer header and saves the returned blob. */
  onDownload: (token: string) => Promise<void>;
  /** Called when `onDownload` rejects. */
  onError?: (message: string) => void;
  label?: string;
  /** Shown instead of `label` while an `onDownload` fetch is in flight. */
  busyLabel?: string;
  className?: string;
};

/**
 * Shared "Download dump" button for LOS list/report pages: filtered Excel exports all follow the
 * same rule (stay disabled until a filter narrows the result, to avoid an unbounded dump) and the
 * same download mechanic — an authenticated `fetch` with a Bearer header that saves the response
 * blob, so a proxy error surfaces via `onError` instead of failing silently. Reuse this for any
 * other filtered-export button instead of re-implementing it.
 */
export function DownloadDumpButton({
  filtersActive,
  loading,
  resultCount,
  onDownload,
  onSessionExpired,
  onError,
  label = '⬇ Download dump',
  busyLabel = 'Downloading…',
  className = DEFAULT_CLASS,
}: DownloadDumpButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const canDownload = filtersActive && !loading && resultCount > 0 && !downloading;

  const download = useCallback(async () => {
    const token = getLosToken();
    if (!token) {
      onSessionExpired();
      return;
    }
    setDownloading(true);
    try {
      await onDownload(token);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to download the export.');
    } finally {
      setDownloading(false);
    }
  }, [onDownload, onSessionExpired, onError]);

  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={!canDownload}
      title={
        !filtersActive
          ? 'Apply a filter to enable the dump download'
          : loading || downloading
            ? undefined
            : resultCount === 0
              ? 'No records match the current filters'
              : undefined
      }
      className={className}
    >
      {downloading ? busyLabel : label}
    </button>
  );
}

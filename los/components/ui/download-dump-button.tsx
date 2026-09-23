'use client';

import { getLosToken } from '@/lib/auth';
import { useCallback, useState } from 'react';

const DEFAULT_CLASS =
  'min-h-[32px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.06)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

type DownloadDumpButtonBaseProps = {
  /** Whether at least one filter is applied — the dump stays disabled until one is, to avoid an unbounded dump. */
  filtersActive: boolean;
  /** True while the list (or the debounced filters) hasn't settled yet — disables the button without changing its tooltip. */
  loading: boolean;
  /** Row count under the current filters; 0 disables the button with a "no records" tooltip. */
  resultCount: number;
  /** Called when there's no LOS token in storage (session expired) instead of starting the download. */
  onSessionExpired: () => void;
  /** Called when `onDownload` rejects (the `buildUrl` mechanic can't fail synchronously here). */
  onError?: (message: string) => void;
  label?: string;
  /** Shown instead of `label` while an `onDownload` fetch is in flight. */
  busyLabel?: string;
  className?: string;
};

export type DownloadDumpButtonProps = DownloadDumpButtonBaseProps &
  (
    | {
        /** Builds the export URL from the signed-in LOS token (a same-origin `access_token` query param, since a plain download link can't carry an Authorization header). Triggers a plain anchor-click download. */
        buildUrl: (token: string) => string;
        onDownload?: undefined;
      }
    | {
        buildUrl?: undefined;
        /** Fetches the export with the token as a Bearer header and saves the returned blob — for endpoints that don't accept a query-string token. */
        onDownload: (token: string) => Promise<void>;
      }
  );

/**
 * Shared "Download dump" button for LOS list/report pages: filtered Excel exports all follow the
 * same rule (stay disabled until a filter narrows the result, to avoid an unbounded dump) and one
 * of two download mechanics — a plain anchor click with an `access_token` query param (`buildUrl`,
 * used by Loans/Leads/Applications/Vendor API Logs), or an authenticated `fetch` with a Bearer
 * header that saves the response blob (`onDownload`, used by the LOS Reports dumps). Reuse this
 * for any other filtered-export button instead of re-implementing either mechanic.
 */
export function DownloadDumpButton({
  filtersActive,
  loading,
  resultCount,
  buildUrl,
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
    if (buildUrl) {
      const link = document.createElement('a');
      link.href = buildUrl(token);
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
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
  }, [buildUrl, onDownload, onSessionExpired, onError]);

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

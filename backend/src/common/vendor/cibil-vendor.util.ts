/** Bureau integrations selectable as the `cibil_fetch` vendor in `vendor_api_config`. */
export type CibilVendorKind = 'tenacio' | 'surepass' | 'cibil07';

const CIBIL_VENDOR_DISPLAY: Record<CibilVendorKind, string> = {
  tenacio: 'Tenacio',
  surepass: 'Surepass',
  cibil07: 'CIBIL07',
};

/** Map a `vendor_api_config.vendor_name` (or payload `sourceVendor`) to a bureau integration. */
export function mapCibilVendorName(vendorName: string): CibilVendorKind {
  const name = vendorName.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (name === 'surepass') return 'surepass';
  if (
    name === 'cibil07' ||
    name === 'mymoneybazaar' ||
    name === 'mmb' ||
    name === 'paymeindia'
  ) {
    return 'cibil07';
  }
  return 'tenacio';
}

export function displayCibilVendorName(kind: CibilVendorKind | null | undefined): string {
  return CIBIL_VENDOR_DISPLAY[kind ?? 'tenacio'];
}

/** Read `sourceVendor` stamped on Surepass / CIBIL07 envelopes; default Tenacio. */
export function inferCibilVendorFromPayload(vendorBody: unknown): CibilVendorKind {
  if (vendorBody == null || typeof vendorBody !== 'object' || Array.isArray(vendorBody)) {
    return 'tenacio';
  }
  const source = (vendorBody as Record<string, unknown>).sourceVendor;
  if (typeof source === 'string' && source.trim()) {
    return mapCibilVendorName(source);
  }
  return 'tenacio';
}

/**
 * Display name for the vendor that pulled CIBIL.
 * Prefers a stored `bureau_report.vendor_name`, then the fetch-chain kind, then payload `sourceVendor`.
 */
export function resolveCibilVendorDisplayName(params: {
  storedVendorName?: string | null;
  vendorKind?: CibilVendorKind | null;
  vendorBody?: unknown;
}): string {
  const stored = params.storedVendorName?.trim();
  if (stored) return stored;
  return displayCibilVendorName(params.vendorKind ?? inferCibilVendorFromPayload(params.vendorBody));
}

/** Bureau integrations selectable as the `cibil_fetch` vendor in `vendor_api_config`. */
export type CibilVendorKind = 'tenacio' | 'surepass' | 'mymoneybazaar';

const CIBIL_VENDOR_DISPLAY: Record<CibilVendorKind, string> = {
  tenacio: 'Tenacio',
  surepass: 'Surepass',
  mymoneybazaar: 'MyMoneyBazaar',
};

/** Map a `vendor_api_config.vendor_name` (or payload `sourceVendor`) to a bureau integration. */
export function mapCibilVendorName(vendorName: string): CibilVendorKind {
  const name = vendorName.trim().toLowerCase();
  if (name === 'surepass') return 'surepass';
  if (
    name === 'mymoneybazaar' ||
    name === 'my money bazaar' ||
    name === 'mmb' ||
    name === 'paymeindia' ||
    name === 'payme india'
  ) {
    return 'mymoneybazaar';
  }
  return 'tenacio';
}

export function displayCibilVendorName(kind: CibilVendorKind | null | undefined): string {
  return CIBIL_VENDOR_DISPLAY[kind ?? 'tenacio'];
}

/** Read `sourceVendor` stamped on Surepass / MyMoneyBazaar envelopes; default Tenacio. */
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

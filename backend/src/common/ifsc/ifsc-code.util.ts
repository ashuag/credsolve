export type IfscCodeFields = {
  ifscCode: string;
  bankName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  apiPayload: Record<string, unknown>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function pickString(data: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function clipNullable(value: string | null, max: number): string | null {
  if (!value) return null;
  return clip(value, max);
}

function normalizePincode(raw: string | null): string | null {
  if (!raw) return null;
  const six = raw.match(/\b(\d{6})\b/);
  if (six) return six[1];
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 6) return digits;
  return clip(raw, 10);
}

/** Vendor envelope `{ data: { … } }` or a flat Razorpay-style IFSC object. */
export function extractVendorIfscData(vendor: unknown): Record<string, unknown> | null {
  if (!isRecord(vendor)) return null;
  const nested = vendor.data;
  if (isRecord(nested)) return nested;
  if (
    typeof vendor.BANK === 'string' ||
    typeof vendor.bankName === 'string' ||
    typeof vendor.IFSC === 'string' ||
    typeof vendor.ifsc === 'string'
  ) {
    return vendor;
  }
  return null;
}

export function mapIfscDataToFields(ifsc: string, data: Record<string, unknown>): IfscCodeFields {
  const fromPayload = pickString(data, ['ifsc', 'IFSC', 'ifscCode', 'ifscNumber']);
  return {
    ifscCode: (fromPayload ?? ifsc).toUpperCase(),
    bankName: clip(pickString(data, ['bankName', 'BANK', 'bank', 'BANKNAME']) ?? '', 150),
    address: clipNullable(pickString(data, ['address', 'ADDRESS']), 500),
    city: clipNullable(pickString(data, ['city', 'CITY']), 100),
    state: clipNullable(pickString(data, ['state', 'STATE']), 100),
    pincode: normalizePincode(
      pickString(data, ['pincode', 'pinCode', 'PINCODE', 'pin', 'PIN', 'postalCode']),
    ),
    apiPayload: data,
  };
}

export function detailsFromIfscRow(row: {
  ifscCode: string;
  bankName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  apiPayload: unknown;
}): Record<string, unknown> {
  const extras = isRecord(row.apiPayload) ? row.apiPayload : {};
  return {
    ...extras,
    bankName: row.bankName || pickString(extras, ['bankName', 'BANK', 'bank']) || row.bankName,
    ifsc: row.ifscCode,
    address: row.address ?? pickString(extras, ['address', 'ADDRESS']),
    city: row.city ?? pickString(extras, ['city', 'CITY']),
    state: row.state ?? pickString(extras, ['state', 'STATE']),
    pincode: row.pincode ?? pickString(extras, ['pincode', 'pinCode', 'PINCODE', 'pin']),
  };
}

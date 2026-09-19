function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function normalizeAadhaarNumber(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidAadhaarNumber(raw: string): boolean {
  return /^\d{12}$/.test(normalizeAadhaarNumber(raw));
}

export function maskAadhaarNumber(raw: string): string {
  const digits = normalizeAadhaarNumber(raw);
  if (digits.length < 4) return 'XXXXXXXXXXXX';
  return `${'X'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function extractAadhaarXmlReferenceId(vendor: unknown): string | null {
  if (!isRecord(vendor)) return null;
  const bags: Record<string, unknown>[] = [vendor];
  if (isRecord(vendor.data)) bags.push(vendor.data);
  if (isRecord(vendor.output)) bags.push(vendor.output);
  for (const bag of bags) {
    for (const key of ['referenceId', 'reference_id'] as const) {
      const value = bag[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }
  return null;
}

export function isAadhaarXmlDownloadValid(vendor: unknown): boolean {
  if (!isRecord(vendor)) return false;
  const data = isRecord(vendor.data) ? vendor.data : vendor;
  const status = typeof data.status === 'string' ? data.status.trim().toUpperCase() : '';
  if (status) return status === 'VALID';
  return Boolean(data.name || data.fullName || data.full_name);
}

export function redactAadhaarXmlOtpRequest(body: unknown): unknown {
  if (!isRecord(body)) return body;
  const input = body.input;
  if (!isRecord(input)) return body;
  const aadhaarNumber = typeof input.aadhaarNumber === 'string' ? input.aadhaarNumber : '';
  return {
    ...body,
    input: {
      ...input,
      aadhaarNumber: aadhaarNumber ? maskAadhaarNumber(aadhaarNumber) : input.aadhaarNumber,
    },
  };
}

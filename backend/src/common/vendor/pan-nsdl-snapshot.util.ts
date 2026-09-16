import { TENACIO_SERVICE_PAN_NAME_DOB } from './tenacio/tenacio-client.service';

function formatName(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export type PanNsdlSnapshot = {
  fullName: string | null;
  panNumber: string | null;
  nameMatch: boolean | null;
  dobMatch: boolean | null;
  panStatus: string | null;
};

type PanNsdlCacheSource = {
  panNumber: string;
  fullName: string;
  nameVerified: boolean;
  nsdlResponse: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 1) return true;
  if (value === 0) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'yes' || normalized === '1') return true;
    if (normalized === 'false' || normalized === 'no' || normalized === '0') return false;
  }
  return null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function pickName(...candidates: unknown[]): string | null {
  for (const value of candidates) {
    const name = formatName(asText(value));
    if (name) return name;
  }
  return null;
}

function pickPan(...candidates: unknown[]): string | null {
  for (const value of candidates) {
    const pan = asText(value)?.toUpperCase() ?? null;
    if (pan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return pan;
  }
  return null;
}

export function panNsdlVendorServiceNames(): string[] {
  return [...new Set(
    [(process.env.TENACIO_PAN_NSDL_SERVICE ?? '').trim(), TENACIO_SERVICE_PAN_NAME_DOB].filter(Boolean),
  )];
}

function extractFromVendorPayload(
  responsePayload: unknown,
  requestPayload: unknown,
): PanNsdlSnapshot | null {
  const response = asRecord(responsePayload);
  const request = asRecord(requestPayload);
  if (!response && !request) return null;

  const responseData = asRecord(response?.data);
  const requestInput = asRecord(request?.input);
  const fullName = pickName(
    responseData?.fullName,
    responseData?.name,
    responseData?.registeredName,
    responseData?.panName,
    response?.fullName,
    response?.name,
    requestInput?.name,
    requestInput?.fullName,
    request?.name,
  );
  const panNumber = pickPan(
    responseData?.panNumber,
    requestInput?.panNumber,
    request?.panNumber,
  );
  const nameMatch =
    asBool(responseData?.nameMatch) ??
    asBool(responseData?.name_match) ??
    asBool(responseData?.name_matched) ??
    asBool(response?.nameMatch) ??
    asBool(response?.name_match) ??
    asBool(response?.name_matched);
  const dobMatch =
    asBool(responseData?.dobMatch) ??
    asBool(responseData?.dob_match) ??
    asBool(responseData?.dob_matched) ??
    asBool(response?.dobMatch) ??
    asBool(response?.dob_match) ??
    asBool(response?.dob_matched);
  const panStatus = asText(responseData?.panStatus) ?? asText(responseData?.pan_status) ?? asText(response?.panStatus);

  if (!fullName && !panNumber && nameMatch == null && dobMatch == null && !panStatus) {
    return null;
  }

  return { fullName, panNumber, nameMatch, dobMatch, panStatus };
}

export function extractPanNsdlSnapshot(input: {
  requestPayload?: unknown;
  responsePayload?: unknown;
  cache?: PanNsdlCacheSource | null;
}): PanNsdlSnapshot | null {
  const fromLog = extractFromVendorPayload(input.responsePayload, input.requestPayload);
  if (fromLog) return fromLog;

  const cache = input.cache;
  if (!cache) return null;

  const fromCacheBody = extractFromVendorPayload(cache.nsdlResponse, {
    input: { panNumber: cache.panNumber, name: cache.fullName },
  });
  if (fromCacheBody) {
    return {
      ...fromCacheBody,
      fullName: fromCacheBody.fullName ?? formatName(cache.fullName),
      panNumber: fromCacheBody.panNumber ?? pickPan(cache.panNumber),
      nameMatch: fromCacheBody.nameMatch ?? cache.nameVerified,
    };
  }

  return {
    fullName: formatName(cache.fullName),
    panNumber: pickPan(cache.panNumber),
    nameMatch: cache.nameVerified,
    dobMatch: true,
    panStatus: 'valid',
  };
}

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
  return typeof value === 'boolean' ? value : null;
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
  const nameMatch = asBool(responseData?.nameMatch) ?? asBool(response?.nameMatch);
  const dobMatch = asBool(responseData?.dobMatch) ?? asBool(response?.dobMatch);
  const panStatus = asText(responseData?.panStatus) ?? asText(response?.panStatus);

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

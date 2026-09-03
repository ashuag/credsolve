function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** `digilocker_aadhaar_form_json` rows that only record a failed vendor attempt (not a captured Aadhaar). */
export function isDigilockerAadhaarCaptureComplete(formJson: unknown): boolean {
  if (formJson == null || !isRecord(formJson)) return false;
  if (formJson._vendorAttempt === true || formJson._identityMismatch === true) return false;
  return true;
}

export function buildDigilockerVendorAttemptJson(params: {
  httpStatus: number | null;
  vendor: unknown;
}): Record<string, unknown> {
  return {
    _vendorAttempt: true,
    httpStatus: params.httpStatus,
    vendor: params.vendor ?? null,
    recordedAt: new Date().toISOString(),
  };
}

export function extractDigilockerIdentityMismatch(formJson: unknown): {
  reason: string;
  message: string;
} | null {
  if (!isRecord(formJson) || formJson._identityMismatch !== true) return null;
  const reason = typeof formJson.reason === 'string' && formJson.reason.trim() ? formJson.reason.trim() : 'identity_mismatch';
  const message =
    typeof formJson.message === 'string' && formJson.message.trim()
      ? formJson.message.trim()
      : 'Name or date of birth on Aadhaar does not match the loan application.';
  return { reason, message };
}

/** Persist fetched Aadhaar when identity check fails so LOS can show what came back and why KYC failed. */
export function buildDigilockerIdentityMismatchJson(params: {
  httpStatus: number | null;
  vendor: unknown;
  photoRelativePath: string | null;
  reason: string;
  message: string;
}): Record<string, unknown> {
  return {
    _vendorAttempt: true,
    _identityMismatch: true,
    reason: params.reason,
    message: params.message,
    httpStatus: params.httpStatus,
    vendor: buildDigilockerAadhaarFormJson(params.vendor, params.photoRelativePath) ?? params.vendor ?? null,
    recordedAt: new Date().toISOString(),
  };
}

/** Tenacio-style envelopes often use `status: "success"` (see bureau mock). */
export function isTenacioVendorBusinessSuccess(vendor: unknown): boolean {
  if (!isRecord(vendor)) return false;
  if (vendor.success === false) return false;
  if (typeof vendor.status === 'string') {
    return vendor.status.trim().toLowerCase() === 'success';
  }
  if (typeof vendor.success === 'boolean') return vendor.success;
  return true;
}

/**
 * DigiLocker callback can hit Tenacio before the session is usable
 * (`status: "error"`, `serviceError.message: "Invalid Input"`, HTTP 200 envelope).
 */
export function isDigilockerSessionNotReadyError(vendor: unknown): boolean {
  if (!isRecord(vendor)) return false;
  if (isTenacioVendorBusinessSuccess(vendor)) return false;
  const code = vendor.serviceStatusCode;
  if (code === 400 || code === '400') return true;
  const err = vendor.serviceError;
  if (isRecord(err) && typeof err.message === 'string') {
    const message = err.message.trim().toLowerCase();
    if (message === 'invalid input' || message.includes('invalid input')) return true;
  }
  return false;
}

/** Best-effort user-facing line from Tenacio error envelopes (`error.message`, string `error`, nested `data`, etc.). */
export function pickTenacioVendorErrorMessage(vendor: unknown, depth = 0): string | undefined {
  if (depth > 6 || !isRecord(vendor)) return undefined;

  const nested = vendor.error;
  if (typeof nested === 'string') {
    const m = nested.trim();
    if (m) return m;
  }
  if (isRecord(nested)) {
    for (const key of ['message', 'description', 'detail', 'title'] as const) {
      const v = nested[key];
      if (typeof v === 'string') {
        const m = v.trim();
        if (m) return m;
      }
    }
  }

  if (typeof vendor.message === 'string') {
    const m = vendor.message.trim();
    if (m) return m;
  }

  const errors = vendor.errors;
  if (Array.isArray(errors)) {
    for (const item of errors) {
      if (typeof item === 'string') {
        const m = item.trim();
        if (m) return m;
      }
      if (isRecord(item)) {
        for (const key of ['message', 'msg', 'description'] as const) {
          const v = item[key];
          if (typeof v === 'string') {
            const m = v.trim();
            if (m) return m;
          }
        }
      }
    }
  }

  const data = vendor.data;
  const fromData = pickTenacioVendorErrorMessage(data, depth + 1);
  if (fromData) return fromData;

  return undefined;
}

const DATA_URL_RE = /^data:image\/(jpeg|jpg|png);base64,(.+)$/i;
const B64ISH_RE = /^[A-Za-z0-9+/=\s\-_]+$/;

function decodeOnePhoto(raw: string): { buffer: Buffer; ext: 'jpg' | 'png' } | null {
  const trimmed = raw.trim();
  const dataUrl = DATA_URL_RE.exec(trimmed.replace(/\s/g, ''));
  if (dataUrl) {
    const mime = (dataUrl[1] ?? 'jpg').toLowerCase();
    const b64 = dataUrl[2] ?? '';
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) return null;
    const ext = mime === 'png' ? 'png' : 'jpg';
    return { buffer: buf, ext };
  }
  if (trimmed.length > 200 && B64ISH_RE.test(trimmed.slice(0, 800))) {
    const buf = Buffer.from(trimmed.replace(/\s/g, ''), 'base64');
    if (buf.length < 100) return null;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    return { buffer: buf, ext: isPng ? 'png' : 'jpg' };
  }
  return null;
}

function photoStringFromValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const decoded = decodeOnePhoto(value);
    return decoded ? value.trim() : null;
  }
  if (!isRecord(value)) return null;
  for (const key of ['content', 'data', 'base64', 'image'] as const) {
    const inner = value[key];
    if (typeof inner === 'string') {
      const decoded = decodeOnePhoto(inner);
      if (decoded) return inner.trim();
    }
  }
  return null;
}

/** Depth-first search for a `photo` string field (base64, data URL, or `{ format, content }`). */
export function extractAadhaarPhotoString(vendor: unknown): string | null {
  const seen = new WeakSet<object>();

  function walk(node: unknown): string | null {
    if (typeof node === 'string') {
      return photoStringFromValue(node);
    }
    if (!node || typeof node !== 'object') return null;
    if (seen.has(node as object)) return null;
    seen.add(node as object);
    if (Array.isArray(node)) {
      for (const x of node) {
        const f = walk(x);
        if (f) return f;
      }
      return null;
    }
    const rec = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      const key = k.toLowerCase();
      if (key === 'photo' || key === 'profile_image' || key === 'profileimage') {
        const fromField = photoStringFromValue(v);
        if (fromField) return fromField;
      }
    }
    for (const v of Object.values(rec)) {
      const f = walk(v);
      if (f) return f;
    }
    return null;
  }

  return walk(vendor);
}

export function decodeAadhaarPhoto(raw: string): { buffer: Buffer; ext: 'jpg' | 'png' } | null {
  return decodeOnePhoto(raw);
}

/**
 * Extracts the liveness score from a Tenacio vendor response.
 * Tries common paths: `output.liveness_score`, `output.score`, `data.liveness_score`,
 * `data.score`, and top-level `liveness_score` / `score`.
 * Returns `null` when no numeric score is found.
 */
export function extractLivenessScore(vendor: unknown): number | null {
  if (!isRecord(vendor)) return null;

  const candidates = [vendor.output, vendor.data, vendor];

  for (const obj of candidates) {
    if (!isRecord(obj)) continue;
    for (const key of ['liveness_score', 'livenessScore', 'score'] as const) {
      const v = obj[key];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = parseFloat(v);
        if (Number.isFinite(n)) return n;
      }
    }
  }

  return null;
}

/**
 * Returns `true` when the Tenacio liveness response confirms `isLive`.
 * Searches `output`, `data`, and root; treats absent field as `null` (caller decides fallback).
 */
export function extractLivenessIsLive(vendor: unknown): boolean | null {
  if (!isRecord(vendor)) return null;

  const candidates = [vendor.output, vendor.data, vendor];

  for (const obj of candidates) {
    if (!isRecord(obj)) continue;
    for (const key of ['isLive', 'is_live', 'liveness'] as const) {
      const v = obj[key];
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') {
        const lower = v.trim().toLowerCase();
        if (lower === 'true' || lower === 'live') return true;
        if (lower === 'false' || lower === 'not_live' || lower === 'spoof') return false;
      }
    }
  }

  return null;
}

/**
 * Returns `true` when the Tenacio response signals that multiple faces were detected.
 * Searches `output`, `data`, and root; treats absent field as `null`.
 */
function parseOcclusionFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (['y', 'yes', 'true', '1', 'detected', 'occluded'].includes(lower)) return true;
    if (['n', 'no', 'false', '0', 'none', 'clear'].includes(lower)) return false;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 0) return true;
    if (value === 0) return false;
  }
  return null;
}

/**
 * Returns `true` when the Tenacio liveness response signals face occlusion / coverage.
 * Searches `output`, `data`, and root; treats absent field as `null`.
 */
export function extractLivenessFaceOccluded(vendor: unknown): boolean | null {
  if (!isRecord(vendor)) return null;

  const candidates = [vendor.output, vendor.data, vendor];

  for (const obj of candidates) {
    if (!isRecord(obj)) continue;
    for (const key of [
      'faceOccluded',
      'face_occluded',
      'faceOcclusion',
      'face_occlusion',
      'occlusionDetected',
      'occlusion_detected',
      'faceOcclusionResult',
      'face_occlusion_result',
      'faceOcclusionDetected',
      'face_occlusion_detected',
    ] as const) {
      const parsed = parseOcclusionFlag(obj[key]);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}

function extractNumericScore(vendor: unknown, keys: string[]): number | null {
  if (!isRecord(vendor)) return null;
  const candidates = [vendor.output, vendor.data, vendor];
  for (const obj of candidates) {
    if (!isRecord(obj)) continue;
    for (const key of keys) {
      const v = obj[key];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = parseFloat(v);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return null;
}

function extractBooleanFlag(vendor: unknown, keys: string[]): boolean | null {
  if (!isRecord(vendor)) return null;
  const candidates = [vendor.output, vendor.data, vendor];
  for (const obj of candidates) {
    if (!isRecord(obj)) continue;
    for (const key of keys) {
      const v = obj[key];
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') {
        const lower = v.trim().toLowerCase();
        if (['true', 'yes', 'y', '1', 'match', 'matched', 'live', 'real', 'authentic'].includes(lower)) {
          return true;
        }
        if (['false', 'no', 'n', '0', 'mismatch', 'not_match', 'deepfake', 'fake', 'synthetic'].includes(lower)) {
          return false;
        }
      }
    }
  }
  return null;
}

/** Face match similarity / confidence score from Tenacio (0–1 or 0–100). */
export function extractFaceMatchScore(vendor: unknown): number | null {
  return extractNumericScore(vendor, [
    'faceMatchScore',
    'face_match_score',
    'matchScore',
    'match_score',
    'similarityScore',
    'similarity_score',
    'confidence',
    'score',
  ]);
}

/** `true` when vendor confirms the two faces match (when field is present). */
export function extractFaceMatchPassed(vendor: unknown): boolean | null {
  return extractBooleanFlag(vendor, [
    'faceMatch',
    'face_match',
    'isMatch',
    'is_match',
    'matched',
    'match',
    'matchResult',
    'match_result',
  ]);
}

export function extractDeepfakeDetected(vendor: unknown): boolean | null {
  const deepfake = extractBooleanFlag(vendor, [
    'isDeepfake',
    'is_deepfake',
    'deepfakeDetected',
    'deepfake_detected',
    'syntheticDetected',
    'synthetic_detected',
    'isSynthetic',
    'is_synthetic',
  ]);
  if (deepfake !== null) return deepfake;

  const authentic = extractBooleanFlag(vendor, ['isAuthentic', 'is_authentic', 'authentic', 'isReal', 'is_real']);
  if (authentic !== null) return !authentic;

  return null;
}

/** Deepfake / authenticity score when provided (higher = more likely real). */
export function extractDeepfakeScore(vendor: unknown): number | null {
  return extractNumericScore(vendor, [
    'authenticityScore',
    'authenticity_score',
    'deepfakeScore',
    'deepfake_score',
    'realScore',
    'real_score',
    'score',
  ]);
}

export function extractLivenessMultipleFacesDetected(vendor: unknown): boolean | null {
  if (!isRecord(vendor)) return null;

  const candidates = [vendor.output, vendor.data, vendor];

  for (const obj of candidates) {
    if (!isRecord(obj)) continue;
    for (const key of ['multipleFacesDetected', 'multiple_faces_detected', 'multipleFaces'] as const) {
      const v = obj[key];
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') {
        const lower = v.trim().toLowerCase();
        if (lower === 'true') return true;
        if (lower === 'false') return false;
      }
    }
  }

  return null;
}

/**
 * Shallow `data` object for form binding; replaces `photo` with a short reference
 * (relative object-storage key) when provided.
 */
export function buildDigilockerAadhaarFormJson(
  vendor: unknown,
  photoRelativePath: string | null,
): Record<string, unknown> | null {
  if (!isRecord(vendor)) return null;
  const data = vendor.data;
  if (!isRecord(data)) {
    return {
      requestId: typeof vendor.requestId === 'string' ? vendor.requestId : undefined,
      type: vendor.type,
      status: vendor.status,
    };
  }
  const base: Record<string, unknown> = { ...data };
  if (typeof base.photo === 'string' || isRecord(base.photo)) {
    base.photo = photoRelativePath ? { storedFile: photoRelativePath } : null;
  }
  if (typeof base.profile_image === 'string' || isRecord(base.profile_image)) {
    base.profile_image = photoRelativePath ? { storedFile: photoRelativePath } : null;
  }
  return base;
}

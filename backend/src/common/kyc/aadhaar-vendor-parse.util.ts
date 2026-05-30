function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
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
const B64ISH_RE = /^[A-Za-z0-9+/=\s]+$/;

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

/** Depth-first search for a `photo` string field (base64 or data URL). */
export function extractAadhaarPhotoString(vendor: unknown): string | null {
  const seen = new WeakSet<object>();

  function walk(node: unknown): string | null {
    if (typeof node === 'string') {
      const d = decodeOnePhoto(node);
      return d ? node.trim() : null;
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
      if (k.toLowerCase() === 'photo' && typeof v === 'string') {
        const d = decodeOnePhoto(v);
        if (d) return v.trim();
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
    for (const key of ['liveness_score', 'score'] as const) {
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
 * (relative path under `KYC_FILES_ROOT`) when provided.
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
  if (typeof base.photo === 'string') {
    base.photo = photoRelativePath ? { storedFile: photoRelativePath } : null;
  }
  return base;
}

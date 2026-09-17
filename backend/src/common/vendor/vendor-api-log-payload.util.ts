/**
 * Bodies stored on `vendor_api_log.response_payload` may be the parsed vendor
 * JSON, or an audit wrapper when the raw HTTP text exceeded the log cap:
 *
 *   { parsed, snippet, _truncated, _originalSize, httpStatus }
 *
 * Downstream mappers must see the inner vendor body (`parsed`), not the wrapper.
 */
export function unwrapVendorApiLogPayload(payload: unknown): unknown {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const rec = payload as Record<string, unknown>;
  if (rec.parsed != null) return rec.parsed;
  return payload;
}

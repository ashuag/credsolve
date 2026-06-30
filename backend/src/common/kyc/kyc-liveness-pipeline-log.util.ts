/** Structured audit entry for each KYC selfie / liveness pipeline step. */
export type KycLivenessPipelineStepLog = {
  step: string;
  at: string;
  ok: boolean;
  request?: unknown;
  response?: unknown;
  httpStatus?: number | null;
  skipReason?: string;
};

export function buildKycPipelineStepLog(
  step: string,
  detail: Omit<KycLivenessPipelineStepLog, 'step' | 'at'>,
): KycLivenessPipelineStepLog {
  return {
    step,
    at: new Date().toISOString(),
    ...detail,
  };
}

export function formatKycPipelineStepForLogger(entry: KycLivenessPipelineStepLog): string {
  const parts = [
    `KYC pipeline [${entry.step}] ok=${entry.ok}`,
    entry.httpStatus != null ? `httpStatus=${entry.httpStatus}` : null,
    entry.skipReason ? `skipReason=${entry.skipReason}` : null,
    entry.request !== undefined ? `request=${JSON.stringify(entry.request)}` : null,
    `response=${JSON.stringify(entry.response ?? null)}`,
  ].filter(Boolean);
  return parts.join(' ');
}

export type LocalKycCheckPhase = '2-internal-liveness' | '2.1-internal-face-match';

export type LocalKycCheckOperation = 'read-storage' | 'validate' | 'compare';

export function isObjectStorageMissingKeyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
  return (
    name === 'NoSuchKey' ||
    /nosuchkey/i.test(msg) ||
    /specified key does not exist/i.test(msg) ||
    /S3 GET failed \(404\)/i.test(msg)
  );
}

/** Human-readable failure line for Nest logs and pipeline `response.error`. */
export function describeLocalKycCheckFailure(
  phase: LocalKycCheckPhase,
  operation: LocalKycCheckOperation,
  relativePath: string,
  err: unknown,
): string {
  const cause = err instanceof Error ? err.message : String(err);
  const asset = phase === '2-internal-liveness' ? 'selfie' : 'Aadhaar reference photo';
  const action =
    operation === 'read-storage'
      ? 'read from object storage'
      : operation === 'validate'
        ? 'run internal liveness on'
        : 'compare';
  if (operation === 'read-storage' && isObjectStorageMissingKeyError(err)) {
    return `${phase}: ${asset} not found in object storage (key="${relativePath}"): ${cause}`;
  }
  return `${phase}: failed to ${action} ${asset} (key="${relativePath}"): ${cause}`;
}

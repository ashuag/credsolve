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

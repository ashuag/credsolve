import {
  extractLivenessIsLive,
  extractLivenessScore,
} from './aadhaar-vendor-parse.util';

export type LivenessVendorSummary = {
  passed: boolean;
  checkedAt: string | null;
  vendorScore: number | null;
  isLive: boolean | null;
  vendorStatus: string | null;
};

export function buildLivenessVendorSummary(params: {
  passed: boolean;
  checkedAt: Date | null;
  vendor: unknown;
}): LivenessVendorSummary | null {
  if (!params.checkedAt && !params.vendor) return null;

  let vendorStatus: string | null = null;
  if (params.vendor && typeof params.vendor === 'object' && !Array.isArray(params.vendor)) {
    const v = params.vendor as Record<string, unknown>;
    if (v.localFaceCheck === true && (v.outboundSkipped === true || v.paused === true)) {
      vendorStatus = 'local-only';
    } else if (typeof v.status === 'string') vendorStatus = v.status;
    else if (typeof v.success === 'boolean') vendorStatus = v.success ? 'success' : 'failed';
  }

  return {
    passed: params.passed,
    checkedAt: params.checkedAt?.toISOString() ?? null,
    vendorScore: extractLivenessScore(params.vendor),
    isLive: extractLivenessIsLive(params.vendor),
    vendorStatus,
  };
}

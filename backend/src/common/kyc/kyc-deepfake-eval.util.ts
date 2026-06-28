import {
  extractDeepfakeDetected,
  extractDeepfakeScore,
  isTenacioVendorBusinessSuccess,
  pickTenacioVendorErrorMessage,
} from './aadhaar-vendor-parse.util';

export type TenacioDeepfakeEvaluation = {
  configured: boolean;
  passed: boolean;
  deepfakeDetected: boolean | null;
  authenticityScore: number | null;
  vendorErrorMessage?: string;
};

export function evaluateTenacioDeepfakeResult(params: {
  configured: boolean;
  httpOk: boolean;
  vendor: unknown;
  skipReason?: string;
}): TenacioDeepfakeEvaluation {
  if (!params.configured) {
    return {
      configured: false,
      passed: true,
      deepfakeDetected: null,
      authenticityScore: null,
    };
  }

  const vendorStatusOk = params.httpOk && isTenacioVendorBusinessSuccess(params.vendor);
  const deepfakeDetected = extractDeepfakeDetected(params.vendor);
  const authenticityScore = extractDeepfakeScore(params.vendor);
  const passed = vendorStatusOk && deepfakeDetected !== true;

  return {
    configured: true,
    passed,
    deepfakeDetected,
    authenticityScore,
    vendorErrorMessage: passed
      ? undefined
      : pickTenacioVendorErrorMessage(params.vendor) ??
        (deepfakeDetected === true
          ? 'This photo appears to be AI-generated or synthetic. Please capture a live selfie from your camera.'
          : params.skipReason),
  };
}

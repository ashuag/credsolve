import { authorizedLosRequest } from './_shared';

export type EnableReKycResult = {
  success: true;
  applicationUuid: string;
  leadUuid: string;
  digilockerCleared: boolean;
  digilockerPreserved?: boolean;
  leadRecovered: boolean;
  applicationRecovered: boolean;
};

/** Reset selfie / liveness so the customer can retake KYC selfie. DigiLocker Aadhaar is kept if already captured. */
export async function enableReKyc(
  token: string,
  applicationUuid: string,
): Promise<EnableReKycResult> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/kyc/enable-re-kyc`,
    { method: 'POST' },
    'Failed to re-enable KYC selfie.',
  );
}

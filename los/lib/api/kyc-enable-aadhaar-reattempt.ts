import { authorizedLosRequest } from './_shared';

export type EnableAadhaarReattemptResult = {
  success: true;
  applicationUuid: string;
  leadUuid: string;
  leadRecovered: boolean;
  applicationRecovered: boolean;
};

/** Reset Aadhaar OTP / DigiLocker attempts so the customer can start Aadhaar OTP again. */
export async function enableAadhaarReattempt(
  token: string,
  applicationUuid: string,
): Promise<EnableAadhaarReattemptResult> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/kyc/enable-aadhaar-reattempt`,
    { method: 'POST' },
    'Failed to enable Aadhaar KYC reattempt.',
  );
}

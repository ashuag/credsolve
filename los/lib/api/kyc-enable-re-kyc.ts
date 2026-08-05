import { authorizedLosRequest } from './_shared';

export type EnableReKycResult = {
  success: true;
  applicationUuid: string;
  leadUuid: string;
  digilockerCleared: boolean;
  leadRecovered: boolean;
  applicationRecovered: boolean;
};

/** Reset DigiLocker / KYC status so the customer can redo identity verification. */
export async function enableReKyc(
  token: string,
  applicationUuid: string,
): Promise<EnableReKycResult> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/kyc/enable-re-kyc`,
    { method: 'POST' },
    'Failed to enable re-KYC.',
  );
}

import { authorizedLosRequest } from './_shared';

export type GrantKycLivenessRetryResult = {
  success: true;
  applicationUuid: string;
  leadUuid: string;
  livenessAttemptsRemaining: number;
  leadRecovered: boolean;
  applicationRecovered: boolean;
};

export async function grantKycLivenessRetry(
  token: string,
  applicationUuid: string,
): Promise<GrantKycLivenessRetryResult> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/kyc/grant-retry`,
    { method: 'POST' },
    'Failed to grant KYC retry.',
  );
}

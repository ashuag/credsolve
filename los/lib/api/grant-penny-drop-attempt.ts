import { authorizedLosRequest } from './_shared';

export type GrantPennyDropAttemptResult = {
  success: true;
  applicationUuid: string;
  attemptsUsed: number;
  attemptsAllowed: number;
  attemptsRemaining: number;
};

/** Give the customer one more penny-drop (bank verification) attempt. */
export async function grantPennyDropAttempt(
  token: string,
  applicationUuid: string,
): Promise<GrantPennyDropAttemptResult> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/bank/grant-penny-drop-attempt`,
    { method: 'POST' },
    'Failed to grant another bank verification attempt.',
  );
}

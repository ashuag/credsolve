import { authorizedLosRequest } from './_shared';

export type RecheckPennyDropResult = {
  success: true;
  applicationUuid: string;
  pennyDropOk: boolean;
  nameMatchScore: number | null;
  nameMatchPendingReview: boolean;
  applicationStatus: string;
  message: string;
};

/** Re-run penny drop on the last submitted bank account. */
export async function recheckPennyDrop(
  token: string,
  applicationUuid: string,
): Promise<RecheckPennyDropResult> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/bank/recheck-penny-drop`,
    { method: 'POST' },
    'Failed to recheck penny drop.',
  );
}

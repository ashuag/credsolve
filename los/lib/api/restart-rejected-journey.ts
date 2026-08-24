import { authorizedLosRequest } from './_shared';

export type RestartRejectedJourneyResult = {
  success: true;
  sourceLeadUuid: string;
  sourceLeadNumber: string;
  newLeadUuid: string;
  newLeadNumber: string;
  copiedFields: string[];
};

export async function restartRejectedLeadJourney(
  token: string,
  leadUuid: string,
): Promise<RestartRejectedJourneyResult> {
  return authorizedLosRequest(
    token,
    `/leads/${encodeURIComponent(leadUuid)}/restart-journey`,
    { method: 'POST' },
    'Failed to restart the customer journey.',
  );
}

export async function restartRejectedApplicationJourney(
  token: string,
  applicationUuid: string,
): Promise<RestartRejectedJourneyResult> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/restart-journey`,
    { method: 'POST' },
    'Failed to restart the customer journey.',
  );
}

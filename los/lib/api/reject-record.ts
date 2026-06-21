import { authorizedLosRequest } from './_shared';

export type RejectWorkspaceRecordPayload = {
  rejectionReasonCode: string;
  notes?: string;
};

export async function rejectLead(
  token: string,
  leadUuid: string,
  payload: RejectWorkspaceRecordPayload,
): Promise<{ success: true; leadUuid: string }> {
  return authorizedLosRequest(
    token,
    `/leads/${encodeURIComponent(leadUuid)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Failed to reject lead.',
  );
}

export async function rejectApplication(
  token: string,
  applicationUuid: string,
  payload: RejectWorkspaceRecordPayload,
): Promise<{ success: true; applicationUuid: string; leadUuid: string }> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Failed to reject application.',
  );
}

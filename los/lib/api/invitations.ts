import { clientApiUrl, fetchWithTimeout, messageFromBody, parseJsonResponse } from './_shared';

export type LosInvitationPreview = {
  fullName: string;
  email: string;
  roleName: string | null;
  expiresAt: string;
};

export async function getInvitationPreview(token: string): Promise<LosInvitationPreview> {
  const response = await fetchWithTimeout(`${clientApiUrl()}/auth/invitations/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  const body = await parseJsonResponse(response);
  if (!response.ok) throw new Error(messageFromBody(body) ?? 'Password setup link has expired.');
  return body as unknown as LosInvitationPreview;
}

export async function acceptInvitation(token: string, data: { password: string }): Promise<{ message: string }> {
  const response = await fetchWithTimeout(`${clientApiUrl()}/auth/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await parseJsonResponse(response);
  if (!response.ok) throw new Error(messageFromBody(body) ?? 'Password setup link has expired.');
  return body as { message: string };
}

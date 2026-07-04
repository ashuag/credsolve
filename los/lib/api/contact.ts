import { authorizedLosRequest, cachedAuthorizedLosGet } from './_shared';

export type LosContactSubmission = {
  id: string;
  uuid: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

type ContactSubmissionsPayload = { submissions: LosContactSubmission[] };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function getContactSubmissions(token: string): Promise<LosContactSubmission[]> {
  const data = await cachedAuthorizedLosGet<ContactSubmissionsPayload>(
    token,
    '/contact-submissions',
    'Failed to fetch contact submissions',
  );
  return data.submissions;
}

export async function markContactSubmissionRead(
  token: string,
  uuid: string,
  isRead: boolean,
): Promise<LosContactSubmission> {
  return authorizedLosRequest<LosContactSubmission>(
    token,
    `/contact-submissions/${uuid}/read`,
    { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ isRead }) },
    'Failed to update contact submission',
  );
}

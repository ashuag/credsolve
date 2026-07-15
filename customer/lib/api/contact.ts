import { apiPost } from './client';

export type ContactSubmissionInput = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

export type ContactSubmissionResult = {
  success: boolean;
  uuid: string;
};

/** Submit the public "Contact Us" form. Throws `ApiRequestError` on validation failure. */
export async function submitContactMessage(
  input: ContactSubmissionInput,
): Promise<ContactSubmissionResult> {
  const data = await apiPost<ContactSubmissionResult>(
    '/contact',
    input,
    'Unable to send your message right now. Please try again.',
  );
  return data ?? { success: true, uuid: '' };
}

import { apiPost } from './client';

export type InitDigilockerResponse = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
};

export async function initDigilockerSession(): Promise<InitDigilockerResponse> {
  const res = await apiPost<InitDigilockerResponse>('/auth/digilocker/init', {}, 'Unable to start DigiLocker.');
  if (!res) {
    throw new Error('Empty response from DigiLocker.');
  }
  return res;
}

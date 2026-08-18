import { authorizedLosRequest } from './_shared';

export type LosNsdlPanVerificationInput = {
  panNumber: string;
  fullName: string;
  dateOfBirth: string;
  consent?: boolean;
};

export type LosNsdlPanVerificationResult = {
  vendor: 'Tenacio NSDL';
  configured: boolean;
  skipReason: string | null;
  structureValid: boolean;
  structureNote: string | null;
  panVerifiedStatus: number;
  panVerifiedLabel: string;
  nameMatch: boolean;
  dobMatch: boolean;
  panStatus: string | null;
  category: string | null;
  vendorRequestId: string | null;
  note: string | null;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
};

/** Live Tenacio NSDL PAN name/DOB verification (developer tool; does not update a lead). */
export async function runNsdlPanVerification(
  token: string,
  input: LosNsdlPanVerificationInput,
): Promise<LosNsdlPanVerificationResult> {
  return authorizedLosRequest<LosNsdlPanVerificationResult>(
    token,
    '/developer-tools/nsdl-pan-verification',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'NSDL PAN verification failed.',
  );
}

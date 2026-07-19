import { authorizedLosRequest } from './_shared';

export type LosCibilVendorFetchInput = {
  mobileNumber: string;
  panNumber: string;
  name: string;
  consent?: boolean;
  /** Required by Surepass; ignored by Tenacio. */
  gender?: 'male' | 'female';
};

export type LosCibilVendorDryRunResult = {
  vendor: 'Tenacio' | 'Surepass';
  configured: boolean;
  skipReason: string | null;
  ok: boolean;
  httpStatus: number | null;
  isNewToCredit: boolean;
  serviceErrorMessage: string | null;
  errorMessage: string | null;
  vendorBody: unknown | null;
};

/** Live Tenacio CIBIL soft-pull (developer tool; bypasses the vendor switch). */
export async function runCibilTenacioFetch(
  token: string,
  input: LosCibilVendorFetchInput,
): Promise<LosCibilVendorDryRunResult> {
  return authorizedLosRequest<LosCibilVendorDryRunResult>(
    token,
    '/developer-tools/cibil-tenacio-fetch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Tenacio CIBIL fetch failed.',
  );
}

/** Live Surepass CIBIL fetch-report (developer tool; bypasses the vendor switch). */
export async function runCibilSurepassFetch(
  token: string,
  input: LosCibilVendorFetchInput,
): Promise<LosCibilVendorDryRunResult> {
  return authorizedLosRequest<LosCibilVendorDryRunResult>(
    token,
    '/developer-tools/cibil-surepass-fetch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Surepass CIBIL fetch failed.',
  );
}

import { authorizedLosRequest } from './_shared';

export type LosGetPaymentStatusInput = {
  txnid: string;
};

export type LosGetPaymentStatusResult = {
  vendor: 'Easebuzz';
  configured: boolean;
  skipReason: string | null;
  retrieveUrl: string | null;
  txnid: string;
  ok: boolean;
  status: string | null;
  amount: string | null;
  easepayid: string | null;
  bankRef: string | null;
  message: string | null;
  vendorBody: unknown | null;
};

/** Live Easebuzz Transaction V2.1 retrieve (developer tool; does not update a loan). */
export async function runGetPaymentStatus(
  token: string,
  input: LosGetPaymentStatusInput,
): Promise<LosGetPaymentStatusResult> {
  return authorizedLosRequest<LosGetPaymentStatusResult>(
    token,
    '/developer-tools/get-payment-status',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Get payment status failed.',
  );
}

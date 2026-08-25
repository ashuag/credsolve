import { authorizedLosRequest } from './_shared';

export type ApproveApplicationResult = {
  success: true;
  applicationUuid: string;
  statusCode: string;
  alreadyApproved: boolean;
};

export type DisburseApplicationResult = {
  success: true;
  applicationUuid: string;
  statusCode: string;
  loan: {
    uuid: string;
    loanNumber: string;
    loanAccountNumber: string;
    principalAmount: string;
    netDisbursedAmount: string;
    disbursedAt: string;
  };
  paymentGateway: 'easebuzz' | 'skipped';
  transfer: {
    uniqueRequestNumber: string;
    utr: string | null;
    vendorStatus: string | null;
  } | null;
};

export async function approveApplication(
  token: string,
  applicationUuid: string,
): Promise<ApproveApplicationResult> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/approve`,
    { method: 'POST' },
    'Failed to approve application.',
  );
}

export async function approveBankNameMatch(
  token: string,
  applicationUuid: string,
): Promise<{ success: true; applicationUuid: string; statusCode: string }> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/bank/approve-name-match`,
    { method: 'POST' },
    'Failed to approve bank name match.',
  );
}

export async function disburseApplication(
  token: string,
  applicationUuid: string,
): Promise<DisburseApplicationResult> {
  return authorizedLosRequest(
    token,
    `/applications/${encodeURIComponent(applicationUuid)}/disburse`,
    { method: 'POST' },
    'Failed to disburse loan.',
  );
}

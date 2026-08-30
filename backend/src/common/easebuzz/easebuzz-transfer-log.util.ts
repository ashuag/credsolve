/** Normalize Easebuzz quick-transfer JSON stored on `loan_account.gateway_transfer_json`. */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Prefer `data.transfer_request`, else a bare transfer_request, else the object itself when it looks like one. */
export function extractEasebuzzTransferRequest(body: unknown): Record<string, unknown> | null {
  let value: unknown = body;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  const root = asRecord(value);
  if (!root) return null;

  const data = asRecord(root.data);
  const nested = asRecord(data?.transfer_request) ?? asRecord(root.transfer_request);
  if (nested) return nested;

  // Stored payload may already be the transfer_request object.
  if (
    pickString(root.unique_transaction_reference, root.unique_request_number, root.id) != null ||
    pickString(root.status) != null
  ) {
    return root;
  }

  return null;
}

export type EasebuzzDisbursementTransferLog = {
  id: string | null;
  uniqueRequestNumber: string | null;
  uniqueTransactionReference: string | null;
  status: string | null;
  paymentMode: string | null;
  amount: string | null;
  currency: string | null;
  narration: string | null;
  failureReason: string | null;
  serviceCharge: string | null;
  gstAmount: string | null;
  serviceChargeWithGst: string | null;
  beneficiaryAccountName: string | null;
  beneficiaryAccountNumber: string | null;
  beneficiaryAccountIfsc: string | null;
  beneficiaryBankName: string | null;
  sourceVirtualAccount: string | null;
  transferDate: string | null;
  successAt: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
};

function formatAmount(value: number | null): string | null {
  return value == null ? null : value.toFixed(2);
}

export function mapEasebuzzTransferLog(body: unknown): EasebuzzDisbursementTransferLog | null {
  const tr = extractEasebuzzTransferRequest(body);
  if (!tr) return null;

  return {
    id: pickString(tr.id),
    uniqueRequestNumber: pickString(tr.unique_request_number),
    uniqueTransactionReference: pickString(tr.unique_transaction_reference, tr.utr),
    status: pickString(tr.status),
    paymentMode: pickString(tr.payment_mode),
    amount: formatAmount(pickNumber(tr.amount)),
    currency: pickString(tr.currency) ?? 'INR',
    narration: pickString(tr.narration),
    failureReason: pickString(tr.failure_reason),
    serviceCharge: formatAmount(pickNumber(tr.service_charge)),
    gstAmount: formatAmount(pickNumber(tr.gst_amount)),
    serviceChargeWithGst: formatAmount(pickNumber(tr.service_charge_with_gst)),
    beneficiaryAccountName: pickString(tr.beneficiary_account_name),
    beneficiaryAccountNumber: pickString(tr.beneficiary_account_number),
    beneficiaryAccountIfsc: pickString(tr.beneficiary_account_ifsc),
    beneficiaryBankName: pickString(tr.beneficiary_bank_name),
    sourceVirtualAccount: pickString(tr.source_virtual_account),
    transferDate: pickString(tr.transfer_date),
    successAt: pickString(tr.success_at),
    createdAt: pickString(tr.created_at),
    raw: tr,
  };
}

const QUICK_TRANSFER_ACCEPTED_STATUSES = new Set([
  'success',
  'successful',
  'accepted',
  'pending',
  'queued',
  'initiated',
  'in_process',
  'in-process',
  'processing',
]);

const QUICK_TRANSFER_FAILED_STATUSES = new Set([
  'failure',
  'failed',
  'rejected',
  'declined',
  'cancelled',
  'canceled',
  'reversed',
  'bounced',
]);

export type EasebuzzQuickTransferParse = {
  accepted: boolean;
  transferId: string | null;
  vendorStatus: string | null;
  message: string | null;
};

export function isEasebuzzFailedVendorStatus(status: string | null | undefined): boolean {
  return Boolean(status && QUICK_TRANSFER_FAILED_STATUSES.has(status.toLowerCase()));
}

/** Legacy URN (pre-timestamp): MCASH + alphanumeric application number. Used only as a fallback. */
export function easebuzzUniqueRequestNumberForApplication(applicationNumber: string): string {
  const compact = applicationNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `MCASH${compact}`.slice(0, 40);
}

/**
 * Disbursement unique_request_number: application number + unix-ms timestamp.
 * Example: APP2026TSVP8 + 1756535907000 → APP2026TSVP81756535907000
 */
export function buildDisbursementUniqueRequestNumber(
  applicationNumber: string,
  atMs: number = Date.now(),
): string {
  const compact = applicationNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const timestamp = String(Math.trunc(atMs));
  return `${compact}${timestamp}`.slice(0, 40);
}

export function isEasebuzzDuplicateUniqueRequestNumber(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  return /already exists.*unique request number|unique request number.*already exists/i.test(
    message,
  );
}

export function uniqueRequestNumberFromVendorPayload(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;
  return pickString(root.unique_request_number, root.uniqueRequestNumber);
}

export function uniqueRequestNumberFromGatewayJson(
  gatewayTransferJson: unknown,
  applicationNumber: string,
): string {
  const tr = extractEasebuzzTransferRequest(gatewayTransferJson);
  const stored = pickString(tr?.unique_request_number);
  return stored || easebuzzUniqueRequestNumberForApplication(applicationNumber);
}

/**
 * Retrieve payloads may be a single `transfer_request` or a paginated `data.results` list.
 */
export function parseEasebuzzQuickTransferRetrieve(body: unknown): EasebuzzQuickTransferParse {
  const root = asRecord(body);
  const data = asRecord(root?.data);
  const results = data?.results;
  if (Array.isArray(results)) {
    if (results[0] != null) {
      return parseEasebuzzQuickTransferInitiate({
        success: root?.success ?? true,
        data: { transfer_request: results[0] },
      });
    }
    return {
      accepted: false,
      transferId: null,
      vendorStatus: null,
      message: 'Transfer not found at Easebuzz.',
    };
  }
  return parseEasebuzzQuickTransferInitiate(body);
}

/**
 * Easebuzz Wire `POST /quick_transfers/initiate/` returns `{ success: true }` when the
 * HTTP call was accepted — even if `data.transfer_request.status` is `failure`
 * (e.g. virtual account has no cleared balance). Only a non-failed transfer status
 * means money moved or is in flight; those cases must not create a loan.
 */
export function parseEasebuzzQuickTransferInitiate(body: unknown): EasebuzzQuickTransferParse {
  const root = asRecord(body);
  if (!root) {
    return { accepted: false, transferId: null, vendorStatus: null, message: 'Empty Easebuzz response.' };
  }

  const data = asRecord(root.data) ?? asRecord(root.result) ?? root;
  const transferRequest = asRecord(data.transfer_request) ?? asRecord(root.transfer_request);

  const vendorStatus = pickString(
    transferRequest?.status,
    root.transfer_status,
    data.transfer_status,
    data.state,
    // Envelope `status` is only a fallback when there is no transfer_request.
    transferRequest ? null : root.status,
    transferRequest ? null : data.status,
  )?.toLowerCase() ?? null;

  const failureReason = pickString(
    transferRequest?.failure_reason,
    data.failure_reason,
    data.message,
    data.error,
    root.message,
    root.error,
  );

  const transferId = pickString(
    transferRequest?.unique_transaction_reference,
    transferRequest?.utr,
    data.unique_transaction_reference,
    data.utr,
    data.bank_reference_number,
    data.transaction_id,
    transferRequest?.id,
    data.id,
    data.transfer_id,
    root.id,
    root.transfer_id,
    root.utr,
  );

  if (vendorStatus && QUICK_TRANSFER_FAILED_STATUSES.has(vendorStatus)) {
    return {
      accepted: false,
      transferId,
      vendorStatus,
      message: failureReason ?? 'Easebuzz transfer failed. Loan was not disbursed.',
    };
  }

  if (failureReason && !vendorStatus) {
    return {
      accepted: false,
      transferId,
      vendorStatus,
      message: failureReason,
    };
  }

  if (vendorStatus && QUICK_TRANSFER_ACCEPTED_STATUSES.has(vendorStatus)) {
    return { accepted: true, transferId, vendorStatus, message: null };
  }

  const successFlag = root.success;
  const acceptedByFlag =
    successFlag === true ||
    successFlag === 1 ||
    successFlag === 'true' ||
    successFlag === '1';

  // Envelope success without a transfer status: treat as accepted (older payload shapes).
  if (acceptedByFlag && !vendorStatus) {
    return { accepted: true, transferId, vendorStatus, message: null };
  }

  return {
    accepted: false,
    transferId,
    vendorStatus,
    message: failureReason ?? 'Easebuzz did not accept the disbursement transfer. Loan was not disbursed.',
  };
}

/** Payload persisted on loan_account — store transfer_request when present, else full body. */
export function buildGatewayTransferJsonForPersist(rawBody: unknown): unknown {
  const tr = extractEasebuzzTransferRequest(rawBody);
  if (tr) {
    const root = asRecord(rawBody);
    if (root && 'success' in root) {
      return {
        success: root.success === true || root.success === 1 || root.success === 'true',
        data: { transfer_request: tr },
      };
    }
    return { success: true, data: { transfer_request: tr } };
  }
  return rawBody ?? null;
}

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

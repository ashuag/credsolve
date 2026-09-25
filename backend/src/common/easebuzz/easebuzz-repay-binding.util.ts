import { isApplicationNumber } from '../loan/application-number.util';
import type { PendingRepayIntent } from './repay-intent.util';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export type EasebuzzRepayLoanLookup = {
  uuids: string[];
  publicIds: string[];
};

/**
 * EasyCollect dashboard / SMS-link webhooks — not in-app Pay Now.
 * Pay Now uses loan UUID in udf1 and txnid = loanNumber + timestamp.
 */
export function isEasyCollectWebhookPayload(fields: Record<string, string>): boolean {
  const productinfo = (fields.productinfo ?? '').toLowerCase();
  const surl = (fields.surl ?? '').toLowerCase();
  const furl = (fields.furl ?? '').toLowerCase();
  if (productinfo.includes('easycollect') || productinfo.includes('easy collect')) return true;
  if (surl.includes('easy_collect') || furl.includes('easy_collect')) return true;
  const txnid = (fields.txnid ?? '').trim();
  const udf1 = (fields.udf1 ?? '').trim();
  return isApplicationNumber(txnid) && !looksLikeUuid(udf1);
}

/**
 * Pay Now stores the loan UUID in udf1. EasyCollect (dashboard / SMS link) uses
 * the public journey ID as merchant_txn and udf1 instead.
 */
export function easebuzzRepayLoanLookupKeys(
  fields: Record<string, string>,
  intent: PendingRepayIntent | null,
): EasebuzzRepayLoanLookup {
  const uuids: string[] = [];
  const publicIds: string[] = [];

  const addUuid = (value?: string) => {
    const trimmed = (value ?? '').trim();
    if (!looksLikeUuid(trimmed) || uuids.includes(trimmed)) return;
    uuids.push(trimmed);
  };
  const addPublicId = (value?: string) => {
    const trimmed = (value ?? '').trim().toUpperCase();
    if (!isApplicationNumber(trimmed) || publicIds.includes(trimmed)) return;
    publicIds.push(trimmed);
  };

  addUuid(intent?.loanAccountUuid);
  addUuid(fields.udf1);
  addPublicId(fields.udf1);
  addPublicId(fields.txnid);
  return { uuids, publicIds };
}

export function checkEasyCollectLoanBinding(
  fields: Record<string, string>,
  loan: {
    uuid: string;
    loanNumber: string;
    application: { uuid: string };
  },
  intent: PendingRepayIntent | null,
): string | null {
  const udf1 = (fields.udf1 ?? '').trim();
  const udf2 = (fields.udf2 ?? '').trim();
  const udf3 = (fields.udf3 ?? '').trim();
  const txnid = (fields.txnid ?? '').trim();
  const loanNumber = loan.loanNumber.trim().toUpperCase();

  if (udf1) {
    if (looksLikeUuid(udf1) && udf1 !== loan.uuid) return 'udf_loan_mismatch';
    if (isApplicationNumber(udf1) && udf1.toUpperCase() !== loanNumber) {
      return 'udf_loan_mismatch';
    }
  }

  if (udf2 && looksLikeUuid(udf2) && udf2 !== loan.application.uuid) {
    return 'udf_app_mismatch';
  }

  if (udf3) {
    if (isApplicationNumber(udf3) && udf3.toUpperCase() !== loanNumber) {
      return 'udf_loan_number_mismatch';
    }
    if (
      !isApplicationNumber(udf3) &&
      !looksLikeUuid(udf3) &&
      !/^\d+(\.\d+)?$/.test(udf3) &&
      udf3.toUpperCase() !== loanNumber
    ) {
      return 'udf_loan_number_mismatch';
    }
  }

  if (intent) {
    if (intent.loanAccountUuid !== loan.uuid) return 'intent_loan_mismatch';
    if (intent.applicationUuid !== loan.application.uuid) return 'intent_app_mismatch';
    if (intent.loanNumber !== loan.loanNumber) return 'intent_loan_number_mismatch';
  }

  const compactLoan = loan.loanNumber.replace(/[^a-zA-Z0-9_|\/-]/g, '');
  if (compactLoan && !txnid.startsWith(compactLoan)) {
    return 'txnid_loan_mismatch';
  }

  return null;
}

/** Easebuzz `addedon` is usually `YYYY-MM-DD HH:mm:ss[.ffffff]` without a zone. */
export function parseEasebuzzAddedOn(value: string | undefined): Date | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed);
}

/**
 * Unique id for a single Easebuzz collection.
 * EasyCollect reuses merchant `txnid` as the loan/application number, so we prefer
 * `easepayid` (then bank ref) to tell payments apart.
 */
export function easebuzzPaymentVendorRef(fields: Record<string, string>): string {
  const easepayid = (fields.easepayid ?? '').trim();
  if (easepayid && easepayid.toUpperCase() !== 'NA') return easepayid.slice(0, 50);
  const bankRef = (fields.bank_ref_num ?? '').trim();
  if (bankRef && bankRef.toUpperCase() !== 'NA') return bankRef.slice(0, 50);
  const txnid = (fields.txnid ?? '').trim();
  const addedon = (fields.addedon ?? '').trim();
  if (txnid && addedon) return `${txnid}:${addedon}`.slice(0, 50);
  return txnid.slice(0, 50);
}

export function isEasebuzzCallbackSuccessStatus(status: string): boolean {
  return status === 'success' || status === 'successful';
}

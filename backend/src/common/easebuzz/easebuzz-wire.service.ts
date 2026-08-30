import { createHash, timingSafeEqual } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VendorApiService } from '../vendor/vendor-api.service';
import {
  isEasebuzzDuplicateUniqueRequestNumber,
  isEasebuzzFailedVendorStatus,
  parseEasebuzzQuickTransferInitiate,
  parseEasebuzzQuickTransferRetrieve,
} from './easebuzz-transfer-log.util';

export type EasebuzzQuickTransferInput = {
  beneficiaryName: string;
  accountNumber: string;
  ifscCode: string;
  uniqueRequestNumber: string;
  amountInr: number;
  email: string;
  phone: string;
  narration: string;
  leadId: bigint | null;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
};

export type EasebuzzQuickTransferResult = {
  ok: true;
  httpStatus: number | null;
  transferId: string | null;
  uniqueRequestNumber: string;
  vendorStatus: string | null;
  rawBody: unknown;
};

export type AdoptExistingQuickTransferResult =
  | { status: 'accepted'; transfer: EasebuzzQuickTransferResult }
  | { status: 'failed'; message: string | null }
  | { status: 'unknown'; message: string | null };

export type EasebuzzQuickTransferRetrieveResult = {
  httpOk: boolean;
  httpStatus: number | null;
  retrieveUrl: string;
  uniqueRequestNumber: string;
  status: string | null;
  utr: string | null;
  failureReason: string | null;
  message: string | null;
  rawBody: unknown;
};

/** Customer repayment via Easebuzz Payment Gateway (POST /payment/initiateLink). */
export type EasebuzzPayInitiateInput = {
  txnid: string;
  amountInr: number;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  leadId: bigint | null;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  udf6?: string;
  udf7?: string;
  showPaymentMode?: string;
};

export type EasebuzzPayInitiateResult = {
  ok: true;
  httpStatus: number | null;
  txnid: string;
  accessKey: string;
  paymentUrl: string;
  vendorStatus: string | null;
  rawBody: unknown;
};

/** Customer repayment via Easebuzz EasyCollect (payment link + SMS/email/WhatsApp). @deprecated Prefer initiatePaymentLink */
export type EasebuzzEasyCollectInput = {
  name: string;
  email: string;
  phone: string;
  /** Customer loan id (`loan_number`) — sent as `merchant_txn` and included in the hash. */
  merchantTxn: string;
  amountInr: number;
  /** Optional note shown on the collect link / included in hash as `message`. */
  message?: string;
  leadId: bigint | null;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
};

export type EasebuzzEasyCollectResult = {
  ok: true;
  httpStatus: number | null;
  merchantTxn: string;
  collectId: string | null;
  paymentUrl: string | null;
  vendorStatus: string | null;
  rawBody: unknown;
};

/** @deprecated Use EasebuzzEasyCollectInput */
export type EasebuzzPayoutLinkInput = {
  email: string;
  phone: string;
  amountInr: number;
  leadId: bigint | null;
  name?: string;
  merchantTxn?: string;
  message?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  /** @deprecated Prefer `name` */
  beneficiaryName?: string;
  /** @deprecated Prefer `merchantTxn` */
  uniqueRequestNumber?: string;
  /** @deprecated Prefer `message` */
  narration?: string;
  scheduledForYmd?: string;
  upiHandle?: string;
};

/** @deprecated Use EasebuzzEasyCollectResult */
export type EasebuzzPayoutLinkResult = EasebuzzEasyCollectResult & {
  uniqueRequestNumber?: string;
  payoutLinkId?: string | null;
};

type EasebuzzWireTransferConfig = {
  key: string;
  salt: string;
  initiateUrl: string;
  retrieveUrl: string;
  paymentMode: string;
  timeoutMs: number;
};

type EasebuzzEasyCollectConfig = {
  key: string;
  salt: string;
  createUrl: string;
  timeoutMs: number;
  operations: Array<{ type: string; template: string }>;
};

type EasebuzzPayInitiateConfig = {
  key: string;
  salt: string;
  initiateUrl: string;
  payPageBaseUrl: string;
  txnRetrieveUrl: string;
  timeoutMs: number;
  showPaymentMode: string;
  surl: string;
  furl: string;
};

function envTrim(config: ConfigService, key: string): string {
  const direct = process.env[key];
  if (direct != null && String(direct).trim().length > 0) {
    return String(direct).trim();
  }
  const fromNest = config.get<string>(key);
  if (fromNest != null && String(fromNest).trim().length > 0) {
    return String(fromNest).trim();
  }
  return '';
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 4) return '****';
  return `${'*'.repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

/** Round INR to paise and format as `"12.34"` for Wire / EasyCollect / Pay amounts. */
function formatWireAmountInr(amountInr: number): string {
  return (Math.round(amountInr * 100) / 100).toFixed(2);
}

/** Easebuzz firstname pattern: letters, digits, and a small set of punctuation. */
function sanitizeEasebuzzName(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9&._ (),@\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 150);
}

/** Easebuzz productinfo: letters, digits, space, hyphen, pipe. */
function sanitizeEasebuzzProductInfo(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9\s|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 45);
  return cleaned || 'Loan repayment';
}

/** Easebuzz udf1–udf7 allowed characters. */
function sanitizeEasebuzzUdf(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/[^a-zA-Z.0-9\\/,\s_#@\-=+&]/g, '')
    .slice(0, 300);
}

/**
 * Easebuzz Wire quick-transfer Authorization:
 * SHA-512 of pipe string, e.g.
 *   F55E22E7FB|3812194585|KKBK0000201||MCASH12346|10.00|02CBB44D8C
 * = {key}|{account_number}|{ifsc}|{upi_handle}|{unique_request_number}|{amount}|{salt}
 * `upi_handle` is empty for beneficiary_type=bank_account (note the double pipe).
 * `amount` is always 2 decimal places (e.g. 10.00).
 */
function resolveWireTransferRetrieveUrl(initiateUrl: string): string {
  try {
    const parsed = new URL(initiateUrl);
    return `${parsed.origin}/api/v1/transfers/`;
  } catch {
    return 'https://wire.easebuzz.in/api/v1/transfers/';
  }
}

function buildQuickTransferAuthorization(input: {
  key: string;
  accountNumber: string;
  ifscCode: string;
  upiHandle?: string;
  uniqueRequestNumber: string;
  amountStr: string;
  salt: string;
}): string {
  const payload = [
    input.key,
    input.accountNumber,
    input.ifscCode,
    input.upiHandle ?? '',
    input.uniqueRequestNumber,
    input.amountStr,
    input.salt,
  ].join('|');
  return createHash('sha512').update(payload, 'utf8').digest('hex');
}

/**
 * Easebuzz EasyCollect create hash (SHA-512, lowercase hex):
 *   key|merchant_txn|name|email|phone|amount|udf1|udf2|udf3|udf4|udf5|message|salt
 * Empty optional fields still contribute pipe separators.
 */
function buildEasyCollectHash(input: {
  key: string;
  merchantTxn: string;
  name: string;
  email: string;
  phone: string;
  amountStr: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  message?: string;
  salt: string;
}): string {
  const payload = [
    input.key,
    input.merchantTxn,
    input.name,
    input.email,
    input.phone,
    input.amountStr,
    input.udf1 ?? '',
    input.udf2 ?? '',
    input.udf3 ?? '',
    input.udf4 ?? '',
    input.udf5 ?? '',
    input.message ?? '',
    input.salt,
  ].join('|');
  return createHash('sha512').update(payload, 'utf8').digest('hex');
}

/**
 * Easebuzz Payment Gateway initiateLink hash (SHA-512, lowercase hex):
 *   key|txnid|amount|productinfo|firstname|email|udf1|…|udf10|salt
 * Empty udf fields still contribute pipe separators. udf8–udf10 are hashed but not POSTed.
 */
function buildPayInitiateHash(input: {
  key: string;
  txnid: string;
  amountStr: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  udf6?: string;
  udf7?: string;
  salt: string;
}): string {
  const payload = [
    input.key,
    input.txnid,
    input.amountStr,
    input.productinfo,
    input.firstname,
    input.email,
    input.udf1 ?? '',
    input.udf2 ?? '',
    input.udf3 ?? '',
    input.udf4 ?? '',
    input.udf5 ?? '',
    input.udf6 ?? '',
    input.udf7 ?? '',
    '', // udf8
    '', // udf9
    '', // udf10
    input.salt,
  ].join('|');
  return createHash('sha512').update(payload, 'utf8').digest('hex');
}

/**
 * Easebuzz Payment Gateway reverse hash for surl/furl callbacks:
 *   salt|status|udf10|…|udf1|email|firstname|productinfo|amount|txnid|key
 */
export function buildPayCallbackReverseHash(
  response: Record<string, string>,
  salt: string,
): string {
  const fields = [
    'udf10',
    'udf9',
    'udf8',
    'udf7',
    'udf6',
    'udf5',
    'udf4',
    'udf3',
    'udf2',
    'udf1',
    'email',
    'firstname',
    'productinfo',
    'amount',
    'txnid',
    'key',
  ];
  let hashString = `${salt}|${response.status ?? ''}`;
  for (const field of fields) {
    hashString += `|${response[field] ?? ''}`;
  }
  return createHash('sha512').update(hashString, 'utf8').digest('hex');
}

/** Timing-safe compare of Easebuzz reverse hash (hex strings, case-insensitive). */
export function payCallbackHashMatches(provided: string, expected: string): boolean {
  return timingSafeEqualUtf8(provided.trim().toLowerCase(), expected.trim().toLowerCase());
}

/** Timing-safe UTF-8 string equality (rejects unequal lengths without throwing). */
export function timingSafeEqualUtf8(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

/** Transaction retrieve hash: key|txnid|salt */
function buildPayTxnRetrieveHash(key: string, txnid: string, salt: string): string {
  return createHash('sha512').update(`${key}|${txnid}|${salt}`, 'utf8').digest('hex');
}

function parseEasyCollectOperations(raw: string): Array<{ type: string; template: string }> {
  const defaults: Record<string, string> = {
    sms: 'Default sms template',
    email: 'Default email template',
    whatsapp: 'Default whatsapp template',
  };
  const parts = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const types = parts.length > 0 ? parts : ['sms', 'email', 'whatsapp'];
  const ops: Array<{ type: string; template: string }> = [];
  for (const type of types) {
    if (type === 'sms' || type === 'email' || type === 'whatsapp') {
      ops.push({ type, template: defaults[type] });
    }
  }
  return ops.length > 0
    ? ops
    : [
        { type: 'sms', template: defaults.sms },
        { type: 'email', template: defaults.email },
        { type: 'whatsapp', template: defaults.whatsapp },
      ];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

/**
 * Easebuzz Wire — quick bank transfer for loan disbursement.
 * Docs endpoint: POST /api/v1/quick_transfers/initiate/
 */
@Injectable()
export class EasebuzzWireService {
  private readonly logger = new Logger(EasebuzzWireService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly vendorApi: VendorApiService,
  ) {}

  /** When true, LOS may create the loan without calling Easebuzz (local/dev only). */
  isTransferSkipped(): boolean {
    const raw = envTrim(this.config, 'EASEBUZZ_WIRE_SKIP_TRANSFER').toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  }

  /** When true, customer repay settles locally without calling Easebuzz Payment Gateway. */
  isPayInitiateSkipped(): boolean {
    const pay = envTrim(this.config, 'EASEBUZZ_PAY_SKIP').toLowerCase();
    if (pay === '1' || pay === 'true' || pay === 'yes') return true;
    const easy = envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_SKIP').toLowerCase();
    if (easy === '1' || easy === 'true' || easy === 'yes') return true;
    const legacy = envTrim(this.config, 'EASEBUZZ_WIRE_SKIP_PAYOUT_LINK').toLowerCase();
    if (legacy === '1' || legacy === 'true' || legacy === 'yes') return true;
    // Fall back to transfer skip so local env with one flag still works.
    return this.isTransferSkipped();
  }

  /** @deprecated Prefer isPayInitiateSkipped */
  isEasyCollectSkipped(): boolean {
    return this.isPayInitiateSkipped();
  }

  /** @deprecated Prefer isPayInitiateSkipped */
  isPayoutLinkSkipped(): boolean {
    return this.isPayInitiateSkipped();
  }

  assertTransferConfiguredOrThrow(): EasebuzzWireTransferConfig {
    const missing: string[] = [];
    const key = envTrim(this.config, 'EASEBUZZ_WIRE_KEY');
    const salt = envTrim(this.config, 'EASEBUZZ_WIRE_SALT');
    const initiateUrl =
      envTrim(this.config, 'EASEBUZZ_WIRE_INITIATE_URL') ||
      'https://wire.easebuzz.in/api/v1/quick_transfers/initiate/';
    const retrieveUrl =
      envTrim(this.config, 'EASEBUZZ_WIRE_RETRIEVE_URL') || resolveWireTransferRetrieveUrl(initiateUrl);

    if (!key) missing.push('EASEBUZZ_WIRE_KEY');
    if (!salt) missing.push('EASEBUZZ_WIRE_SALT');

    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `Easebuzz Wire is not configured. Missing: ${missing.join(', ')}. ` +
          'Set these in backend/.env, or set EASEBUZZ_WIRE_SKIP_TRANSFER=true for local dry-run.',
      );
    }

    const paymentMode = envTrim(this.config, 'EASEBUZZ_WIRE_PAYMENT_MODE') || 'IMPS';
    const timeoutRaw = Number.parseInt(envTrim(this.config, 'EASEBUZZ_WIRE_TIMEOUT_MS') || '45000', 10);
    const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 45_000;

    return {
      key,
      salt,
      initiateUrl,
      retrieveUrl,
      paymentMode,
      timeoutMs,
    };
  }

  /** @deprecated Prefer assertTransferConfiguredOrThrow */
  assertConfiguredOrThrow(): EasebuzzWireTransferConfig {
    return this.assertTransferConfiguredOrThrow();
  }

  /** @deprecated Prefer assertPayInitiateConfiguredOrThrow */
  assertEasyCollectConfiguredOrThrow(): EasebuzzEasyCollectConfig {
    const missing: string[] = [];
    const key =
      envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_KEY') || envTrim(this.config, 'EASEBUZZ_WIRE_KEY');
    const salt =
      envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_SALT') || envTrim(this.config, 'EASEBUZZ_WIRE_SALT');
    const createUrl =
      envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_CREATE_URL') ||
      'https://testdashboard.easebuzz.in/easycollect/v1/create';

    if (!key) missing.push('EASEBUZZ_EASYCOLLECT_KEY (or EASEBUZZ_WIRE_KEY)');
    if (!salt) missing.push('EASEBUZZ_EASYCOLLECT_SALT (or EASEBUZZ_WIRE_SALT)');

    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `Easebuzz EasyCollect is not configured. Missing: ${missing.join(', ')}. ` +
          'Set these in backend/.env, or set EASEBUZZ_EASYCOLLECT_SKIP=true for local dry-run.',
      );
    }

    const timeoutRaw = Number.parseInt(
      envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_TIMEOUT_MS') ||
        envTrim(this.config, 'EASEBUZZ_WIRE_TIMEOUT_MS') ||
        '45000',
      10,
    );
    const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 45_000;
    const operations = parseEasyCollectOperations(
      envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_OPERATIONS') || 'sms,email,whatsapp',
    );

    return {
      key,
      salt,
      createUrl,
      timeoutMs,
      operations,
    };
  }

  assertPayInitiateConfiguredOrThrow(): EasebuzzPayInitiateConfig {
    const missing: string[] = [];
    const key =
      envTrim(this.config, 'EASEBUZZ_PAY_KEY') ||
      envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_KEY') ||
      envTrim(this.config, 'EASEBUZZ_WIRE_KEY');
    const salt =
      envTrim(this.config, 'EASEBUZZ_PAY_SALT') ||
      envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_SALT') ||
      envTrim(this.config, 'EASEBUZZ_WIRE_SALT');
    const initiateUrl =
      envTrim(this.config, 'EASEBUZZ_PAY_INITIATE_URL') ||
      (envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_CREATE_URL').includes('initiateLink')
        ? envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_CREATE_URL')
        : '') ||
      'https://pay.easebuzz.in/payment/initiateLink';

    if (!key) missing.push('EASEBUZZ_PAY_KEY (or EASEBUZZ_EASYCOLLECT_KEY)');
    if (!salt) missing.push('EASEBUZZ_PAY_SALT (or EASEBUZZ_EASYCOLLECT_SALT)');

    const surl =
      envTrim(this.config, 'EASEBUZZ_PAY_SURL') || this.defaultPayCallbackUrl('success');
    const furl =
      envTrim(this.config, 'EASEBUZZ_PAY_FURL') || this.defaultPayCallbackUrl('failure');
    if (!surl) missing.push('EASEBUZZ_PAY_SURL (or BACKEND_PUBLIC_BASE_URL)');
    if (!furl) missing.push('EASEBUZZ_PAY_FURL (or BACKEND_PUBLIC_BASE_URL)');

    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `Easebuzz Payment Gateway is not configured. Missing: ${missing.join(', ')}. ` +
          'Set these in backend/.env, or set EASEBUZZ_PAY_SKIP=true for local dry-run.',
      );
    }

    const timeoutRaw = Number.parseInt(
      envTrim(this.config, 'EASEBUZZ_PAY_TIMEOUT_MS') ||
        envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_TIMEOUT_MS') ||
        envTrim(this.config, 'EASEBUZZ_WIRE_TIMEOUT_MS') ||
        '45000',
      10,
    );
    const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 45_000;
    const showPaymentMode =
      envTrim(this.config, 'EASEBUZZ_PAY_SHOW_PAYMENT_MODE') || 'NB,DC,UPI';
    const payPageBaseUrl = this.resolvePayPageBaseUrl(initiateUrl);
    const txnRetrieveUrl = this.resolveTxnRetrieveUrl(initiateUrl);

    return {
      key,
      salt,
      initiateUrl,
      payPageBaseUrl,
      txnRetrieveUrl,
      timeoutMs,
      showPaymentMode,
      surl,
      furl,
    };
  }

  /** Merchant credentials for callback verification / transaction retrieve. */
  getPayCredentialsOrThrow(): { key: string; salt: string } {
    const cfg = this.assertPayInitiateConfiguredOrThrow();
    return { key: cfg.key, salt: cfg.salt };
  }

  /** Merchant salt for verifying Easebuzz surl/furl reverse hash. */
  getPaySaltOrThrow(): string {
    return this.assertPayInitiateConfiguredOrThrow().salt;
  }

  /**
   * Server-side confirmation via Easebuzz Transaction V2.1 retrieve.
   * Hash = SHA-512(key|txnid|salt). Required before closing a loan on callback.
   * Pass `forceLive: true` from LOS developer tools so EASEBUZZ_PAY_SKIP_TXN_VERIFY is ignored.
   */
  async retrievePayTransaction(
    txnid: string,
    options?: { forceLive?: boolean },
  ): Promise<{
    ok: boolean;
    status: string | null;
    amount: string | null;
    easepayid: string | null;
    bankRef: string | null;
    rawBody: unknown;
    message: string | null;
    retrieveUrl: string;
  }> {
    const cfg = this.assertPayInitiateConfiguredOrThrow();
    const retrieveUrl = cfg.txnRetrieveUrl;
    const id = txnid.trim().slice(0, 40);
    if (!id) {
      return {
        ok: false,
        status: null,
        amount: null,
        easepayid: null,
        bankRef: null,
        rawBody: null,
        message: 'txnid required',
        retrieveUrl,
      };
    }

    const skipVerify = envTrim(this.config, 'EASEBUZZ_PAY_SKIP_TXN_VERIFY').toLowerCase();
    if (
      !options?.forceLive &&
      (skipVerify === '1' || skipVerify === 'true' || skipVerify === 'yes')
    ) {
      this.logger.warn(`[easebuzz] EASEBUZZ_PAY_SKIP_TXN_VERIFY — skipping transaction retrieve for ${id}`);
      return {
        ok: true,
        status: 'success',
        amount: null,
        easepayid: null,
        bankRef: null,
        rawBody: { skipped: true },
        message: null,
        retrieveUrl,
      };
    }

    const hash = buildPayTxnRetrieveHash(cfg.key, id, cfg.salt);
    const body: Record<string, string> = {
      key: cfg.key,
      txnid: id,
      hash,
    };

    const result = await this.vendorApi.request<unknown, Record<string, string>>({
      providerName: 'Easebuzz',
      serviceName: 'pay-transaction-retrieve',
      method: 'POST',
      absoluteUrl: cfg.txnRetrieveUrl,
      bodyEncoding: 'form',
      body,
      timeoutMs: cfg.timeoutMs,
      redactRequest: (payload) => ({
        ...payload,
        key: typeof payload?.key === 'string' ? `[REDACTED:${payload.key.length} chars]` : payload?.key,
        hash: typeof payload?.hash === 'string' ? `[REDACTED:${payload.hash.length} chars]` : payload?.hash,
      }),
    });

    if (!result.ok) {
      const snippet =
        typeof result.rawText === 'string' && result.rawText
          ? result.rawText.slice(0, 280)
          : result.error?.message ?? 'unknown error';
      this.logger.error(`[easebuzz] Transaction retrieve failed txnid=${id}: ${snippet}`);
      return {
        ok: false,
        status: null,
        amount: null,
        easepayid: null,
        bankRef: null,
        rawBody: result.body,
        message: 'Transaction retrieve failed',
        retrieveUrl,
      };
    }

    return { ...this.parseTxnRetrieveSuccess(result.body, id), retrieveUrl };
  }

  /** Default success/failure redirect targets for initiateLink. */
  getPayCallbackUrls(): { surl: string; furl: string } {
    const cfg = this.assertPayInitiateConfiguredOrThrow();
    return { surl: cfg.surl, furl: cfg.furl };
  }

  /** @deprecated Prefer assertEasyCollectConfiguredOrThrow */
  assertPayoutLinkConfiguredOrThrow(): EasebuzzEasyCollectConfig {
    return this.assertEasyCollectConfiguredOrThrow();
  }

  private defaultPayCallbackUrl(kind: 'success' | 'failure'): string {
    const backendBase = envTrim(this.config, 'BACKEND_PUBLIC_BASE_URL').replace(/\/+$/, '');
    if (!backendBase) return '';
    return `${backendBase}/api/auth/repayments/easebuzz/${kind}`;
  }

  private resolvePayPageBaseUrl(initiateUrl: string): string {
    const explicit = envTrim(this.config, 'EASEBUZZ_PAY_PAGE_BASE_URL').replace(/\/+$/, '');
    if (explicit) return explicit;
    const envHint = envTrim(this.config, 'EASEBUZZ_PAY_ENV').toLowerCase();
    if (envHint === 'test' || envHint === 'sandbox') {
      return 'https://testpay.easebuzz.in';
    }
    if (envHint === 'prod' || envHint === 'production') {
      return 'https://pay.easebuzz.in';
    }
    try {
      const host = new URL(initiateUrl).hostname.toLowerCase();
      if (host.includes('testpay') || host.includes('testdashboard')) {
        return 'https://testpay.easebuzz.in';
      }
    } catch {
      // fall through to prod
    }
    return 'https://pay.easebuzz.in';
  }

  private resolveTxnRetrieveUrl(initiateUrl: string): string {
    const explicit = envTrim(this.config, 'EASEBUZZ_PAY_TXN_RETRIEVE_URL');
    if (explicit) return explicit;
    const envHint = envTrim(this.config, 'EASEBUZZ_PAY_ENV').toLowerCase();
    if (envHint === 'test' || envHint === 'sandbox') {
      return 'https://testdashboard.easebuzz.in/transaction/v2.1/retrieve';
    }
    if (envHint === 'prod' || envHint === 'production') {
      return 'https://dashboard.easebuzz.in/transaction/v2.1/retrieve';
    }
    try {
      const host = new URL(initiateUrl).hostname.toLowerCase();
      if (host.includes('testpay') || host.includes('testdashboard')) {
        return 'https://testdashboard.easebuzz.in/transaction/v2.1/retrieve';
      }
    } catch {
      // fall through
    }
    return 'https://dashboard.easebuzz.in/transaction/v2.1/retrieve';
  }

  private parseTxnRetrieveSuccess(
    body: unknown,
    expectedTxnid: string,
  ): {
    ok: boolean;
    status: string | null;
    amount: string | null;
    easepayid: string | null;
    bankRef: string | null;
    rawBody: unknown;
    message: string | null;
  } {
    const root = asRecord(body);
    if (!root) {
      return {
        ok: false,
        status: null,
        amount: null,
        easepayid: null,
        bankRef: null,
        rawBody: body,
        message: 'Empty transaction response',
      };
    }

    const dataRaw = root.data ?? root.result ?? root.msg;
    let row: Record<string, unknown> | null = null;
    if (Array.isArray(dataRaw) && dataRaw.length > 0) {
      row = asRecord(dataRaw[0]);
    } else {
      row = asRecord(dataRaw) ?? root;
    }

    const status = pickString(
      row?.status,
      row?.txn_status,
      row?.transaction_status,
      root.status,
    )?.toLowerCase() ?? null;

    const txnFromVendor = pickString(row?.txnid, row?.merchant_txn, root.txnid);
    if (txnFromVendor && txnFromVendor !== expectedTxnid) {
      return {
        ok: false,
        status,
        amount: null,
        easepayid: null,
        bankRef: null,
        rawBody: body,
        message: 'txnid mismatch in transaction retrieve',
      };
    }

    const amount = pickString(row?.amount, row?.net_amount, root.amount);
    const easepayid = pickString(row?.easepayid, row?.easebuzz_id, root.easepayid);
    const bankRef = pickString(
      row?.bank_ref_num,
      row?.bank_ref_no,
      row?.upi_va,
      row?.bank_reference_number,
    );

    const successStatuses = new Set(['success', 'successful', 'captured', 'completed']);
    const apiRejected =
      root.status === 0 ||
      root.status === false ||
      root.status === '0' ||
      String(root.status ?? '').toLowerCase() === 'failure' ||
      String(root.status ?? '').toLowerCase() === 'failed';
    const ok = !apiRejected && Boolean(status && successStatuses.has(status));

    return {
      ok,
      status,
      amount,
      easepayid,
      bankRef,
      rawBody: body,
      message: ok ? null : pickString(root.message, root.error, row?.error, row?.message),
    };
  }

  async initiateQuickTransfer(input: EasebuzzQuickTransferInput): Promise<EasebuzzQuickTransferResult> {
    const cfg = this.assertTransferConfiguredOrThrow();

    if (!(input.amountInr > 0) || !Number.isFinite(input.amountInr)) {
      throw new BadRequestException('Disbursement amount must be a positive number.');
    }

    const amountStr = formatWireAmountInr(input.amountInr);
    const accountNumber = input.accountNumber.replace(/\s+/g, '');
    const ifscCode = input.ifscCode.trim().toUpperCase();
    const uniqueRequestNumber = input.uniqueRequestNumber.trim().slice(0, 64);

    // Easebuzz quick-transfer body (no virtual_account_number) — amount sent as number with 2dp.
    const body: Record<string, unknown> = {
      key: cfg.key,
      beneficiary_type: 'bank_account',
      beneficiary_name: input.beneficiaryName.trim().slice(0, 100),
      account_number: accountNumber,
      ifsc: ifscCode,
      unique_request_number: uniqueRequestNumber,
      payment_mode: cfg.paymentMode,
      amount: Number(amountStr),
      email: input.email.trim().slice(0, 120),
      phone: input.phone.replace(/\D/g, '').slice(-10),
      narration: input.narration.trim().slice(0, 50) || 'loan disbursed',
    };

    const authorization = buildQuickTransferAuthorization({
      key: cfg.key,
      accountNumber,
      ifscCode,
      uniqueRequestNumber,
      amountStr,
      salt: cfg.salt,
    });

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: authorization,
      // Easebuzz expects the merchant key as the header name (not "WIRE-API-KEY").
      [cfg.key]: '',
    };

    this.logger.log(
      `[easebuzz] Initiating transfer unique=${uniqueRequestNumber} amount=${amountStr} mode=${cfg.paymentMode}`,
    );

    const result = await this.vendorApi.request<unknown, Record<string, unknown>>({
      providerName: 'Easebuzz',
      serviceName: 'quick-transfer-initiate',
      method: 'POST',
      absoluteUrl: cfg.initiateUrl,
      headers,
      body,
      leadId: input.leadId,
      timeoutMs: cfg.timeoutMs,
      sensitiveHeaderNames: [cfg.key],
    });

    if (!result.ok) {
      const snippet =
        typeof result.rawText === 'string' && result.rawText
          ? result.rawText.slice(0, 280)
          : result.error?.message ?? 'unknown error';
      this.logger.error(
        `[easebuzz] Transfer failed http=${result.httpStatus ?? 'n/a'} unique=${input.uniqueRequestNumber}: ${snippet}`,
      );
      throw new ServiceUnavailableException(
        'Disbursement transfer failed at Easebuzz. Loan account was not created. Check vendor_api_log and try again.',
      );
    }

    const parsed = this.parseSuccess(result.body);
    if (!parsed.accepted) {
      this.logger.error(
        `[easebuzz] Transfer rejected unique=${input.uniqueRequestNumber} status=${parsed.vendorStatus ?? 'n/a'} ` +
          `reason=${parsed.message ?? 'n/a'}`,
      );
      if (isEasebuzzDuplicateUniqueRequestNumber(parsed.message)) {
        const existing = await this.adoptExistingQuickTransfer(
          input.uniqueRequestNumber,
          input.leadId,
        );
        if (existing.status === 'accepted') return existing.transfer;
        throw new ConflictException(
          parsed.message ?? 'A disbursement payment already exists for this request number.',
        );
      }
      throw new UnprocessableEntityException(
        parsed.message ?? 'Easebuzz transfer failed. Loan was not disbursed.',
      );
    }

    return {
      ok: true,
      httpStatus: result.httpStatus,
      transferId: parsed.transferId,
      uniqueRequestNumber: input.uniqueRequestNumber,
      vendorStatus: parsed.vendorStatus,
      rawBody: result.body,
    };
  }

  /**
   * When Easebuzz already has this URN, retrieve it instead of treating the
   * duplicate as a new failure. Returns null when the existing transfer failed
   * or is not yet visible.
   */
  async adoptExistingQuickTransfer(
    uniqueRequestNumber: string,
    leadId?: bigint | null,
  ): Promise<AdoptExistingQuickTransferResult> {
    const existing = await this.retrieveQuickTransfer(uniqueRequestNumber, { leadId });
    const existingParsed = parseEasebuzzQuickTransferRetrieve(existing.rawBody);
    if (existingParsed.accepted) {
      this.logger.log(
        `[easebuzz] Reusing existing transfer unique=${uniqueRequestNumber} ` +
          `status=${existingParsed.vendorStatus ?? existing.status ?? 'n/a'}`,
      );
      return {
        status: 'accepted',
        transfer: {
          ok: true,
          httpStatus: existing.httpStatus,
          transferId: existingParsed.transferId ?? existing.utr,
          uniqueRequestNumber,
          vendorStatus: existingParsed.vendorStatus ?? existing.status,
          rawBody: existing.rawBody,
        },
      };
    }
    const message = existingParsed.message ?? existing.message ?? null;
    if (isEasebuzzFailedVendorStatus(existingParsed.vendorStatus ?? existing.status)) {
      this.logger.warn(
        `[easebuzz] Existing transfer unique=${uniqueRequestNumber} failed: ${message ?? 'n/a'}`,
      );
      return { status: 'failed', message };
    }
    this.logger.warn(
      `[easebuzz] Existing transfer unique=${uniqueRequestNumber} is not reusable ` +
        `status=${existingParsed.vendorStatus ?? existing.status ?? 'n/a'} reason=${message ?? 'n/a'}`,
    );
    return { status: 'unknown', message };
  }

  /**
   * Live Wire retrieve — GET /api/v1/transfers/?unique_request_number=
   * Hash = SHA-512(key|unique_request_number|salt). Does not initiate a payout.
   */
  async retrieveQuickTransfer(
    uniqueRequestNumber: string,
    options?: { leadId?: bigint | null },
  ): Promise<EasebuzzQuickTransferRetrieveResult> {
    const cfg = this.assertTransferConfiguredOrThrow();
    const urn = uniqueRequestNumber.trim().slice(0, 64);
    if (!urn) {
      return {
        httpOk: false,
        httpStatus: null,
        retrieveUrl: cfg.retrieveUrl,
        uniqueRequestNumber: '',
        status: null,
        utr: null,
        failureReason: null,
        message: 'unique_request_number is required.',
        rawBody: null,
      };
    }

    const retrieveUrl = `${cfg.retrieveUrl.replace(/\/?$/, '/')}?unique_request_number=${encodeURIComponent(urn)}`;
    const authorization = createHash('sha512').update(`${cfg.key}|${urn}|${cfg.salt}`, 'utf8').digest('hex');
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: authorization,
      [cfg.key]: '',
    };

    const result = await this.vendorApi.request<unknown, undefined>({
      providerName: 'Easebuzz',
      serviceName: 'quick-transfer-retrieve',
      method: 'GET',
      absoluteUrl: retrieveUrl,
      headers,
      leadId: options?.leadId ?? null,
      timeoutMs: cfg.timeoutMs,
      sensitiveHeaderNames: [cfg.key],
    });

    const parsed = parseEasebuzzQuickTransferRetrieve(result.body);
    const httpOk = result.ok && result.httpStatus != null && result.httpStatus >= 200 && result.httpStatus < 300;

    return {
      httpOk,
      httpStatus: result.httpStatus,
      retrieveUrl,
      uniqueRequestNumber: urn,
      status: parsed.vendorStatus,
      utr: parsed.transferId,
      failureReason: parsed.accepted ? null : parsed.message,
      message: httpOk ? parsed.message : result.error?.message ?? parsed.message ?? 'Transfer retrieve failed.',
      rawBody: result.body,
    };
  }

  /**
   * Create an Easebuzz Payment Gateway session (customer repayment / Pay Now).
   * Docs: POST /payment/initiateLink (form-urlencoded)
   *
   * Hash = SHA-512 of
   *   key|txnid|amount|productinfo|firstname|email|udf1|…|udf10|salt
   * Success response `data` is a 64-char access_key; payment URL is `{payBase}/pay/{access_key}`.
   */
  async initiatePaymentLink(input: EasebuzzPayInitiateInput): Promise<EasebuzzPayInitiateResult> {
    const cfg = this.assertPayInitiateConfiguredOrThrow();

    if (!(input.amountInr > 0) || !Number.isFinite(input.amountInr)) {
      throw new BadGatewayException('Repayment amount must be a positive number.');
    }

    const amountStr = formatWireAmountInr(input.amountInr);
    const phone = input.phone.replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) {
      throw new BadGatewayException('Payee phone must be a 10-digit mobile number.');
    }

    const txnid = input.txnid.trim().slice(0, 40);
    if (!txnid || !/^[a-zA-Z0-9_|\/-]{1,40}$/.test(txnid)) {
      throw new BadGatewayException('txnid is invalid for Easebuzz Payment Gateway.');
    }

    const firstname = sanitizeEasebuzzName(input.firstname);
    const email = input.email.trim().slice(0, 200);
    const productinfo = sanitizeEasebuzzProductInfo(input.productinfo);
    const surl = (input.surl || cfg.surl).trim().slice(0, 2000);
    const furl = (input.furl || cfg.furl).trim().slice(0, 2000);
    if (!surl || !furl) {
      throw new BadGatewayException('Easebuzz surl and furl are required.');
    }

    const udf1 = sanitizeEasebuzzUdf(input.udf1);
    const udf2 = sanitizeEasebuzzUdf(input.udf2);
    const udf3 = sanitizeEasebuzzUdf(input.udf3);
    const udf4 = sanitizeEasebuzzUdf(input.udf4);
    const udf5 = sanitizeEasebuzzUdf(input.udf5);
    const udf6 = sanitizeEasebuzzUdf(input.udf6);
    const udf7 = sanitizeEasebuzzUdf(input.udf7);
    const showPaymentMode = (input.showPaymentMode || cfg.showPaymentMode).trim();

    const hash = buildPayInitiateHash({
      key: cfg.key,
      txnid,
      amountStr,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      udf6,
      udf7,
      salt: cfg.salt,
    });

    const body: Record<string, string> = {
      key: cfg.key,
      txnid,
      amount: amountStr,
      productinfo,
      firstname,
      phone,
      email,
      surl,
      furl,
      hash,
    };
    if (udf1) body.udf1 = udf1;
    if (udf2) body.udf2 = udf2;
    if (udf3) body.udf3 = udf3;
    if (udf4) body.udf4 = udf4;
    if (udf5) body.udf5 = udf5;
    if (udf6) body.udf6 = udf6;
    if (udf7) body.udf7 = udf7;
    if (showPaymentMode) body.show_payment_mode = showPaymentMode;

    this.logger.log(
      `[easebuzz] Initiating pay link txnid=${txnid} amount=${amountStr} phone=${maskPhone(phone)}`,
    );

    const result = await this.vendorApi.request<unknown, Record<string, string>>({
      providerName: 'Easebuzz',
      serviceName: 'pay-initiate-link',
      method: 'POST',
      absoluteUrl: cfg.initiateUrl,
      bodyEncoding: 'form',
      body,
      leadId: input.leadId,
      timeoutMs: cfg.timeoutMs,
      redactRequest: (payload) => this.redactPayInitiateRequest(payload),
    });

    if (!result.ok) {
      const snippet =
        typeof result.rawText === 'string' && result.rawText
          ? result.rawText.slice(0, 280)
          : result.error?.message ?? 'unknown error';
      this.logger.error(
        `[easebuzz] Pay initiateLink failed http=${result.httpStatus ?? 'n/a'} txnid=${txnid}: ${snippet}`,
      );
      throw new BadGatewayException(
        'Could not start repayment at Easebuzz. Please try again shortly.',
      );
    }

    const parsed = this.parsePayInitiateSuccess(result.body);
    if (!parsed.accepted || !parsed.accessKey) {
      this.logger.error(
        `[easebuzz] Pay initiateLink rejected txnid=${txnid} status=${parsed.vendorStatus ?? 'n/a'}`,
      );
      throw new BadGatewayException(
        parsed.message ?? 'Easebuzz did not accept the repayment payment request.',
      );
    }

    const paymentUrl = `${cfg.payPageBaseUrl.replace(/\/+$/, '')}/pay/${parsed.accessKey}`;

    return {
      ok: true,
      httpStatus: result.httpStatus,
      txnid,
      accessKey: parsed.accessKey,
      paymentUrl,
      vendorStatus: parsed.vendorStatus,
      rawBody: result.body,
    };
  }

  /**
   * Create an Easebuzz EasyCollect payment link (customer repayment / Pay Now).
   * Docs: POST /easycollect/v1/create
   *
   * Hash (body field) = SHA-512 of
   *   key|merchant_txn|name|email|phone|amount|udf1|udf2|udf3|udf4|udf5|message|salt
   * @deprecated Prefer {@link initiatePaymentLink}
   */
  async createEasyCollect(input: EasebuzzEasyCollectInput): Promise<EasebuzzEasyCollectResult> {
    const cfg = this.assertEasyCollectConfiguredOrThrow();

    if (!(input.amountInr > 0) || !Number.isFinite(input.amountInr)) {
      throw new BadGatewayException('Repayment amount must be a positive number.');
    }

    const amountStr = formatWireAmountInr(input.amountInr);
    const phone = input.phone.replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) {
      throw new BadGatewayException('Payee phone must be a 10-digit mobile number.');
    }

    const name = input.name.trim().slice(0, 100);
    const email = input.email.trim().slice(0, 120);
    const merchantTxn = input.merchantTxn.trim().slice(0, 40);
    if (!merchantTxn) {
      throw new BadGatewayException('merchant_txn (customer loan id) is required for EasyCollect.');
    }
    // Hash always includes udf1–udf5 + message even when empty (pipe separators still present).
    const message = (input.message ?? '').trim().slice(0, 200);
    const udf1 = (input.udf1 ?? '').trim();
    const udf2 = (input.udf2 ?? '').trim();
    const udf3 = (input.udf3 ?? '').trim();
    const udf4 = (input.udf4 ?? '').trim();
    const udf5 = (input.udf5 ?? '').trim();

    const hash = buildEasyCollectHash({
      key: cfg.key,
      merchantTxn,
      name,
      email,
      phone,
      amountStr,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      message,
      salt: cfg.salt,
    });

    // Body matches Easebuzz EasyCollect create sample (amount as "1.00" string).
    const body: Record<string, unknown> = {
      key: cfg.key,
      merchant_txn: merchantTxn,
      name,
      email,
      amount: amountStr,
      phone,
      operation: cfg.operations,
      hash,
    };
    if (message) body.message = message;
    if (udf1) body.udf1 = udf1;
    if (udf2) body.udf2 = udf2;
    if (udf3) body.udf3 = udf3;
    if (udf4) body.udf4 = udf4;
    if (udf5) body.udf5 = udf5;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    this.logger.log(
      `[easebuzz] Creating EasyCollect txn=${merchantTxn || '(auto)'} amount=${amountStr} phone=${maskPhone(phone)}`,
    );

    const result = await this.vendorApi.request<unknown, Record<string, unknown>>({
      providerName: 'Easebuzz',
      serviceName: 'easycollect-create',
      method: 'POST',
      absoluteUrl: cfg.createUrl,
      headers,
      body,
      leadId: input.leadId,
      timeoutMs: cfg.timeoutMs,
      redactRequest: (payload) => this.redactEasyCollectRequest(payload),
    });

    if (!result.ok) {
      const snippet =
        typeof result.rawText === 'string' && result.rawText
          ? result.rawText.slice(0, 280)
          : result.error?.message ?? 'unknown error';
      this.logger.error(
        `[easebuzz] EasyCollect failed http=${result.httpStatus ?? 'n/a'} txn=${merchantTxn}: ${snippet}`,
      );
      throw new BadGatewayException(
        'Could not create repayment payment link at Easebuzz. Please try again shortly.',
      );
    }

    const parsed = this.parseEasyCollectSuccess(result.body);
    if (!parsed.accepted) {
      this.logger.error(
        `[easebuzz] EasyCollect rejected txn=${merchantTxn} status=${parsed.vendorStatus ?? 'n/a'}`,
      );
      throw new BadGatewayException(
        parsed.message ?? 'Easebuzz did not accept the repayment EasyCollect request.',
      );
    }

    return {
      ok: true,
      httpStatus: result.httpStatus,
      merchantTxn: parsed.merchantTxn ?? merchantTxn,
      collectId: parsed.collectId,
      paymentUrl: parsed.paymentUrl,
      vendorStatus: parsed.vendorStatus,
      rawBody: result.body,
    };
  }

  /** @deprecated Prefer createEasyCollect */
  async createPayoutLink(input: EasebuzzPayoutLinkInput): Promise<EasebuzzPayoutLinkResult> {
    const created = await this.createEasyCollect({
      name: (input.name || input.beneficiaryName || '').trim(),
      email: input.email,
      phone: input.phone,
      merchantTxn: (input.merchantTxn || input.uniqueRequestNumber || '').trim(),
      amountInr: input.amountInr,
      message: input.message || input.narration,
      leadId: input.leadId,
      udf1: input.udf1,
      udf2: input.udf2,
      udf3: input.udf3,
      udf4: input.udf4,
      udf5: input.udf5,
    });
    return {
      ...created,
      uniqueRequestNumber: created.merchantTxn,
      payoutLinkId: created.collectId,
    };
  }

  private redactEasyCollectRequest(body: Record<string, unknown> | undefined): unknown {
    if (!body) return body;
    return {
      ...body,
      key: typeof body.key === 'string' ? `[REDACTED:${body.key.length} chars]` : body.key,
      hash: typeof body.hash === 'string' ? `[REDACTED:${body.hash.length} chars]` : body.hash,
      email: typeof body.email === 'string' ? maskEmail(body.email) : body.email,
      phone: typeof body.phone === 'string' ? maskPhone(body.phone) : body.phone,
    };
  }

  private redactPayInitiateRequest(body: Record<string, string> | undefined): unknown {
    if (!body) return body;
    return {
      ...body,
      key: typeof body.key === 'string' ? `[REDACTED:${body.key.length} chars]` : body.key,
      hash: typeof body.hash === 'string' ? `[REDACTED:${body.hash.length} chars]` : body.hash,
      email: typeof body.email === 'string' ? maskEmail(body.email) : body.email,
      phone: typeof body.phone === 'string' ? maskPhone(body.phone) : body.phone,
    };
  }

  private parsePayInitiateSuccess(body: unknown): {
    accepted: boolean;
    accessKey: string | null;
    vendorStatus: string | null;
    message: string | null;
  } {
    const root = asRecord(body);
    if (!root) {
      return {
        accepted: false,
        accessKey: null,
        vendorStatus: null,
        message: 'Empty Easebuzz response.',
      };
    }

    const statusRaw = root.status;
    const acceptedByFlag =
      statusRaw === 1 ||
      statusRaw === true ||
      statusRaw === '1' ||
      statusRaw === 'true' ||
      String(statusRaw ?? '').toLowerCase() === 'success';

    const accessKey = pickString(root.data, asRecord(root.data)?.access_key, root.access_key);
    const looksLikeAccessKey =
      typeof accessKey === 'string' && /^[a-f0-9]{64}$/i.test(accessKey);

    const message = pickString(root.message, root.error, root.data);
    // When status!=1, `data` is often an error object/string — not an access key.
    const accepted = acceptedByFlag && looksLikeAccessKey;

    return {
      accepted,
      accessKey: looksLikeAccessKey ? accessKey : null,
      vendorStatus: pickString(statusRaw)?.toLowerCase() ?? null,
      message: accepted ? null : (typeof message === 'string' ? message : 'Easebuzz initiateLink failed.'),
    };
  }

  private parseEasyCollectSuccess(body: unknown): {
    accepted: boolean;
    collectId: string | null;
    merchantTxn: string | null;
    paymentUrl: string | null;
    vendorStatus: string | null;
    message: string | null;
  } {
    const root = asRecord(body);
    if (!root) {
      return {
        accepted: false,
        collectId: null,
        merchantTxn: null,
        paymentUrl: null,
        vendorStatus: null,
        message: 'Empty Easebuzz response.',
      };
    }

    const data = asRecord(root.data) ?? asRecord(root.result) ?? root;
    const vendorStatus = pickString(
      root.status,
      data.status,
      data.state,
      data.link_status,
    )?.toLowerCase() ?? null;

    const successFlag = root.status ?? root.success;
    const acceptedByFlag =
      successFlag === true ||
      successFlag === 1 ||
      successFlag === 'true' ||
      successFlag === '1' ||
      String(successFlag ?? '').toLowerCase() === 'success';

    const acceptedStatuses = new Set([
      'success',
      'successful',
      'accepted',
      'active',
      'created',
      'pending',
      'unpaid',
    ]);
    const acceptedByStatus = vendorStatus != null && acceptedStatuses.has(vendorStatus);
    const paymentUrl = pickString(
      data.pay_hash_url,
      data.payment_url,
      data.payout_link,
      data.payout_link_url,
      data.link,
      data.url,
      data.short_url,
      root.pay_hash_url,
      root.payment_url,
      root.payout_link,
      root.payout_link_url,
      root.link,
      root.url,
    );
    // A payment URL alone means the collect link was created successfully.
    const accepted = acceptedByFlag || acceptedByStatus || Boolean(paymentUrl);

    const collectId = pickString(
      data.id,
      data.collect_id,
      data.payout_link_id,
      data.link_id,
      root.id,
      root.collect_id,
      root.payout_link_id,
    );

    const merchantTxn = pickString(data.merchant_txn, root.merchant_txn);

    const message = pickString(root.message, root.error, data.message, data.error);

    return { accepted, collectId, merchantTxn, paymentUrl, vendorStatus, message };
  }

  private parseSuccess(body: unknown) {
    return parseEasebuzzQuickTransferInitiate(body);
  }
}

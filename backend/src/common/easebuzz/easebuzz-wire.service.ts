import { createHash } from 'node:crypto';
import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VendorApiService } from '../vendor/vendor-api.service';

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

/** Customer repayment via Easebuzz EasyCollect (payment link + SMS/email/WhatsApp). */
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

function maskAccount(account: string): string {
  const digits = account.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
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

/** Round INR to paise and format as `"12.34"` for Wire / EasyCollect amounts. */
function formatWireAmountInr(amountInr: number): string {
  return (Math.round(amountInr * 100) / 100).toFixed(2);
}

/**
 * Easebuzz Wire quick-transfer Authorization:
 * SHA-512 of pipe string, e.g.
 *   F55E22E7FB|3812194585|KKBK0000201||MCASH12346|10.00|02CBB44D8C
 * = {key}|{account_number}|{ifsc}|{upi_handle}|{unique_request_number}|{amount}|{salt}
 * `upi_handle` is empty for beneficiary_type=bank_account (note the double pipe).
 * `amount` is always 2 decimal places (e.g. 10.00).
 */
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

  /** When true, customer repay settles locally without calling Easebuzz EasyCollect. */
  isEasyCollectSkipped(): boolean {
    const easy = envTrim(this.config, 'EASEBUZZ_EASYCOLLECT_SKIP').toLowerCase();
    if (easy === '1' || easy === 'true' || easy === 'yes') return true;
    const legacy = envTrim(this.config, 'EASEBUZZ_WIRE_SKIP_PAYOUT_LINK').toLowerCase();
    if (legacy === '1' || legacy === 'true' || legacy === 'yes') return true;
    // Fall back to transfer skip so local env with one flag still works.
    return this.isTransferSkipped();
  }

  /** @deprecated Prefer isEasyCollectSkipped */
  isPayoutLinkSkipped(): boolean {
    return this.isEasyCollectSkipped();
  }

  assertTransferConfiguredOrThrow(): EasebuzzWireTransferConfig {
    const missing: string[] = [];
    const key = envTrim(this.config, 'EASEBUZZ_WIRE_KEY');
    const salt = envTrim(this.config, 'EASEBUZZ_WIRE_SALT');
    const initiateUrl =
      envTrim(this.config, 'EASEBUZZ_WIRE_INITIATE_URL') ||
      'https://wire.easebuzz.in/api/v1/quick_transfers/initiate/';

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
      paymentMode,
      timeoutMs,
    };
  }

  /** @deprecated Prefer assertTransferConfiguredOrThrow */
  assertConfiguredOrThrow(): EasebuzzWireTransferConfig {
    return this.assertTransferConfiguredOrThrow();
  }

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

  /** @deprecated Prefer assertEasyCollectConfiguredOrThrow */
  assertPayoutLinkConfiguredOrThrow(): EasebuzzEasyCollectConfig {
    return this.assertEasyCollectConfiguredOrThrow();
  }

  async initiateQuickTransfer(input: EasebuzzQuickTransferInput): Promise<EasebuzzQuickTransferResult> {
    const cfg = this.assertTransferConfiguredOrThrow();

    if (!(input.amountInr > 0) || !Number.isFinite(input.amountInr)) {
      throw new BadGatewayException('Disbursement amount must be a positive number.');
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
      redactRequest: (payload) => this.redactRequest(payload),
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
      throw new BadGatewayException(
        'Disbursement transfer failed at Easebuzz. Loan account was not created. Check vendor_api_log and try again.',
      );
    }

    const parsed = this.parseSuccess(result.body);
    if (!parsed.accepted) {
      this.logger.error(
        `[easebuzz] Transfer rejected unique=${input.uniqueRequestNumber} status=${parsed.vendorStatus ?? 'n/a'}`,
      );
      throw new BadGatewayException(
        parsed.message ??
          'Easebuzz did not accept the disbursement transfer. Loan account was not created.',
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
   * Create an Easebuzz EasyCollect payment link (customer repayment / Pay Now).
   * Docs: POST /easycollect/v1/create
   *
   * Hash (body field) = SHA-512 of
   *   key|merchant_txn|name|email|phone|amount|udf1|udf2|udf3|udf4|udf5|message|salt
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

  private redactRequest(body: Record<string, unknown> | undefined): unknown {
    if (!body) return body;
    return {
      ...body,
      key: typeof body.key === 'string' ? `[REDACTED:${body.key.length} chars]` : body.key,
      account_number:
        typeof body.account_number === 'string' ? maskAccount(body.account_number) : body.account_number,
      email: typeof body.email === 'string' ? maskEmail(body.email) : body.email,
      phone: typeof body.phone === 'string' ? maskPhone(body.phone) : body.phone,
      virtual_account_number:
        typeof body.virtual_account_number === 'string'
          ? maskAccount(body.virtual_account_number)
          : body.virtual_account_number,
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

  private parseSuccess(body: unknown): {
    accepted: boolean;
    transferId: string | null;
    vendorStatus: string | null;
    message: string | null;
  } {
    const root = asRecord(body);
    if (!root) {
      return { accepted: false, transferId: null, vendorStatus: null, message: 'Empty Easebuzz response.' };
    }

    const data = asRecord(root.data) ?? asRecord(root.result) ?? root;
    const transferRequest = asRecord(data.transfer_request) ?? asRecord(root.transfer_request);

    const vendorStatus = pickString(
      transferRequest?.status,
      root.status,
      root.transfer_status,
      data.status,
      data.transfer_status,
      data.state,
    )?.toLowerCase() ?? null;

    const successFlag = root.success;
    const acceptedByFlag =
      successFlag === true ||
      successFlag === 1 ||
      successFlag === 'true' ||
      successFlag === '1' ||
      String(root.status ?? '').toLowerCase() === 'success';

    const acceptedStatuses = new Set([
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
    const acceptedByStatus = vendorStatus != null && acceptedStatuses.has(vendorStatus);
    const accepted = acceptedByFlag || acceptedByStatus;

    // Prefer bank UTR / unique_transaction_reference over vendor transfer id (trc…).
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

    const message = pickString(
      root.message,
      root.error,
      data.message,
      data.error,
      transferRequest?.failure_reason,
    );

    return { accepted, transferId, vendorStatus, message };
  }
}

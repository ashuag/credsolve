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

export type EasebuzzPayoutLinkInput = {
  payeeName: string;
  payeeEmail: string;
  payeePhone: string;
  uniqueCode: string;
  amountInr: number;
  expiryDateYmd: string;
  description: string;
  leadId: bigint | null;
  allowedBeneficiaryTypes?: Array<'upi' | 'bank_account'>;
};

export type EasebuzzPayoutLinkResult = {
  ok: true;
  httpStatus: number | null;
  uniqueCode: string;
  payoutLinkId: string | null;
  paymentUrl: string | null;
  vendorStatus: string | null;
  rawBody: unknown;
};

type EasebuzzWireTransferConfig = {
  key: string;
  salt: string;
  wireApiKey: string;
  virtualAccountNumber: string;
  initiateUrl: string;
  paymentMode: string;
  timeoutMs: number;
};

type EasebuzzWirePayoutLinkConfig = {
  authorization: string;
  key: string;
  wireApiKey: string;
  payoutLinksUrl: string;
  timeoutMs: number;
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

function todayYmdIst(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA → YYYY-MM-DD
  return fmt.format(new Date());
}

/** Round INR to paise, then format for Wire body + Authorization hash (always 2 decimals). */
function formatWireAmountInr(amountInr: number): { amount: number; amountStr: string } {
  const amount = Math.round(amountInr * 100) / 100;
  const amountStr = amount.toFixed(2);
  return { amount, amountStr };
}

/**
 * Easebuzz Wire quick-transfer Authorization:
 * SHA-512("{key}|{account_number}|{ifsc}|{upi_handle}|{unique_request_number}|{amount}|{salt}")
 * `upi_handle` is empty for beneficiary_type=bank_account.
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

  /** When true, customer repay returns a dry-run link without calling Easebuzz. */
  isPayoutLinkSkipped(): boolean {
    const raw = envTrim(this.config, 'EASEBUZZ_WIRE_SKIP_PAYOUT_LINK').toLowerCase();
    if (raw === '1' || raw === 'true' || raw === 'yes') return true;
    // Fall back to transfer skip so local env with one flag still works.
    return this.isTransferSkipped();
  }

  assertTransferConfiguredOrThrow(): EasebuzzWireTransferConfig {
    const missing: string[] = [];
    const key = envTrim(this.config, 'EASEBUZZ_WIRE_KEY');
    const salt = envTrim(this.config, 'EASEBUZZ_WIRE_SALT');
    const virtualAccountNumber = envTrim(this.config, 'EASEBUZZ_WIRE_VIRTUAL_ACCOUNT_NUMBER');
    const wireApiKey = envTrim(this.config, 'EASEBUZZ_WIRE_API_KEY');
    const initiateUrl =
      envTrim(this.config, 'EASEBUZZ_WIRE_INITIATE_URL') ||
      'https://wire.easebuzz.in/api/v1/quick_transfers/initiate/';

    if (!key) missing.push('EASEBUZZ_WIRE_KEY');
    if (!salt) missing.push('EASEBUZZ_WIRE_SALT');
    if (!virtualAccountNumber) missing.push('EASEBUZZ_WIRE_VIRTUAL_ACCOUNT_NUMBER');

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
      wireApiKey,
      virtualAccountNumber,
      initiateUrl,
      paymentMode,
      timeoutMs,
    };
  }

  /** @deprecated Prefer assertTransferConfiguredOrThrow */
  assertConfiguredOrThrow(): EasebuzzWireTransferConfig {
    return this.assertTransferConfiguredOrThrow();
  }

  assertPayoutLinkConfiguredOrThrow(): EasebuzzWirePayoutLinkConfig {
    const missing: string[] = [];
    const authorization = envTrim(this.config, 'EASEBUZZ_WIRE_AUTHORIZATION');
    const key = envTrim(this.config, 'EASEBUZZ_WIRE_KEY');
    const wireApiKey = envTrim(this.config, 'EASEBUZZ_WIRE_API_KEY');
    const payoutLinksUrl =
      envTrim(this.config, 'EASEBUZZ_WIRE_PAYOUT_LINKS_URL') ||
      'https://wire.easebuzz.in/api/v1/payout_links/';

    if (!authorization) missing.push('EASEBUZZ_WIRE_AUTHORIZATION');
    if (!key) missing.push('EASEBUZZ_WIRE_KEY');
    if (!wireApiKey) missing.push('EASEBUZZ_WIRE_API_KEY');

    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `Easebuzz Wire payout links are not configured. Missing: ${missing.join(', ')}. ` +
          'Set these in backend/.env, or set EASEBUZZ_WIRE_SKIP_PAYOUT_LINK=true for local dry-run.',
      );
    }

    const timeoutRaw = Number.parseInt(envTrim(this.config, 'EASEBUZZ_WIRE_TIMEOUT_MS') || '45000', 10);
    const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 45_000;

    return {
      authorization,
      key,
      wireApiKey,
      payoutLinksUrl,
      timeoutMs,
    };
  }

  async initiateQuickTransfer(input: EasebuzzQuickTransferInput): Promise<EasebuzzQuickTransferResult> {
    const cfg = this.assertTransferConfiguredOrThrow();

    if (!(input.amountInr > 0) || !Number.isFinite(input.amountInr)) {
      throw new BadGatewayException('Disbursement amount must be a positive number.');
    }

    const { amount, amountStr } = formatWireAmountInr(input.amountInr);
    const accountNumber = input.accountNumber.replace(/\s+/g, '');
    const ifscCode = input.ifscCode.trim().toUpperCase();
    const uniqueRequestNumber = input.uniqueRequestNumber.trim().slice(0, 64);
    const includeScheduled =
      envTrim(this.config, 'EASEBUZZ_WIRE_INCLUDE_SCHEDULED_FOR').toLowerCase() !== 'false';

    const body: Record<string, unknown> = {
      key: cfg.key,
      virtual_account_number: cfg.virtualAccountNumber,
      beneficiary_type: 'bank_account',
      beneficiary_name: input.beneficiaryName.trim().slice(0, 100),
      account_number: accountNumber,
      ifsc_code: ifscCode,
      unique_request_number: uniqueRequestNumber,
      payment_mode: cfg.paymentMode,
      amount,
      email: input.email.trim().slice(0, 120),
      phone: input.phone.replace(/\D/g, '').slice(-10),
      narration: input.narration.trim().slice(0, 50) || 'loan disbursed',
      udf1: (input.udf1 ?? '').slice(0, 50),
      udf2: (input.udf2 ?? '').slice(0, 50),
      udf3: (input.udf3 ?? '').slice(0, 50),
      udf4: (input.udf4 ?? '').slice(0, 50),
      udf5: (input.udf5 ?? '').slice(0, 50),
    };

    if (includeScheduled) {
      body.scheduled_for = todayYmdIst();
    }

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
      'WIRE-API-KEY': cfg.wireApiKey,
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
      sensitiveHeaderNames: ['WIRE-API-KEY'],
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
   * Create an Easebuzz Wire payout link (customer repayment / Pay Now).
   * Docs: POST /api/v1/payout_links/
   */
  async createPayoutLink(input: EasebuzzPayoutLinkInput): Promise<EasebuzzPayoutLinkResult> {
    const cfg = this.assertPayoutLinkConfiguredOrThrow();

    if (!(input.amountInr > 0) || !Number.isFinite(input.amountInr)) {
      throw new BadGatewayException('Repayment amount must be a positive number.');
    }

    const amount = Math.round(input.amountInr * 100) / 100;
    const phone = input.payeePhone.replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) {
      throw new BadGatewayException('Payee phone must be a 10-digit mobile number.');
    }

    const body: Record<string, unknown> = {
      key: cfg.key,
      payee_name: input.payeeName.trim().slice(0, 100),
      payee_email: input.payeeEmail.trim().slice(0, 120),
      payee_phone: phone,
      unique_code: input.uniqueCode.trim().slice(0, 40),
      allowed_beneficiary_types: input.allowedBeneficiaryTypes ?? ['upi', 'bank_account'],
      amount,
      expiry_date: input.expiryDateYmd,
      description: input.description.trim().slice(0, 100) || 'loan repayment',
    };

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: cfg.authorization,
      'WIRE-API-KEY': cfg.wireApiKey,
    };

    this.logger.log(
      `[easebuzz] Creating payout link unique=${body.unique_code} amount=${amount} phone=${maskPhone(phone)}`,
    );

    const result = await this.vendorApi.request<unknown, Record<string, unknown>>({
      providerName: 'Easebuzz',
      serviceName: 'payout-link-create',
      method: 'POST',
      absoluteUrl: cfg.payoutLinksUrl,
      headers,
      body,
      leadId: input.leadId,
      timeoutMs: cfg.timeoutMs,
      redactRequest: (payload) => this.redactPayoutLinkRequest(payload),
      sensitiveHeaderNames: ['WIRE-API-KEY'],
    });

    if (!result.ok) {
      const snippet =
        typeof result.rawText === 'string' && result.rawText
          ? result.rawText.slice(0, 280)
          : result.error?.message ?? 'unknown error';
      this.logger.error(
        `[easebuzz] Payout link failed http=${result.httpStatus ?? 'n/a'} unique=${input.uniqueCode}: ${snippet}`,
      );
      throw new BadGatewayException(
        'Could not create repayment payout link at Easebuzz. Please try again shortly.',
      );
    }

    const parsed = this.parsePayoutLinkSuccess(result.body);
    if (!parsed.accepted) {
      this.logger.error(
        `[easebuzz] Payout link rejected unique=${input.uniqueCode} status=${parsed.vendorStatus ?? 'n/a'}`,
      );
      throw new BadGatewayException(
        parsed.message ?? 'Easebuzz did not accept the repayment payout link.',
      );
    }

    return {
      ok: true,
      httpStatus: result.httpStatus,
      uniqueCode: input.uniqueCode,
      payoutLinkId: parsed.payoutLinkId,
      paymentUrl: parsed.paymentUrl,
      vendorStatus: parsed.vendorStatus,
      rawBody: result.body,
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

  private redactPayoutLinkRequest(body: Record<string, unknown> | undefined): unknown {
    if (!body) return body;
    return {
      ...body,
      key: typeof body.key === 'string' ? `[REDACTED:${body.key.length} chars]` : body.key,
      payee_email: typeof body.payee_email === 'string' ? maskEmail(body.payee_email) : body.payee_email,
      payee_phone: typeof body.payee_phone === 'string' ? maskPhone(body.payee_phone) : body.payee_phone,
    };
  }

  private parsePayoutLinkSuccess(body: unknown): {
    accepted: boolean;
    payoutLinkId: string | null;
    paymentUrl: string | null;
    vendorStatus: string | null;
    message: string | null;
  } {
    const root = asRecord(body);
    if (!root) {
      return {
        accepted: false,
        payoutLinkId: null,
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
      'active',
      'created',
      'pending',
    ]);
    const acceptedByStatus = vendorStatus != null && acceptedStatuses.has(vendorStatus);
    const accepted = acceptedByFlag || acceptedByStatus;

    const paymentUrl = pickString(
      data.payment_url,
      data.payout_link,
      data.payout_link_url,
      data.link,
      data.url,
      data.short_url,
      root.payment_url,
      root.payout_link,
      root.payout_link_url,
      root.link,
      root.url,
    );

    const payoutLinkId = pickString(
      data.id,
      data.payout_link_id,
      data.link_id,
      root.id,
      root.payout_link_id,
    );

    const message = pickString(root.message, root.error, data.message, data.error);

    return { accepted, payoutLinkId, paymentUrl, vendorStatus, message };
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
    const vendorStatus = pickString(
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

    const transferId = pickString(
      data.id,
      data.transfer_id,
      data.unique_transaction_reference,
      data.utr,
      data.bank_reference_number,
      data.transaction_id,
      root.id,
      root.transfer_id,
      root.utr,
    );

    const message = pickString(root.message, root.error, data.message, data.error);

    return { accepted, transferId, vendorStatus, message };
  }
}

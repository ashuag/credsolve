import {BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException} from '@nestjs/common';
import type {Request} from 'express';
import {PrismaService} from '../../../../prisma/prisma.service';
import {VendorApiService} from '../../../../common/vendor/vendor-api.service';
import {CustomerRepository} from '../../infrastructure/repositories/customer.repository';
import {LeadRepository} from '../../infrastructure/repositories/lead.repository';
import type {VerifyPanDto} from '../dto/verify-pan.dto';


const logger = new Logger();

function parseDobUtc(dob: string): Date {
  const [y, m, d] = dob.split('-').map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new BadRequestException('Invalid date of birth.');
  }
  return new Date(Date.UTC(y, m - 1, d));
}

/** Convert ISO `YYYY-MM-DD` to vendor's `DD-MM-YYYY` body format. */
function formatDobDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function maskPanForAudit(pan: string | undefined): string {
  if (!pan || pan.length < 4) return '*****';
  return `******${pan.slice(-4)}`;
}

function maskDobForAudit(dob: string | undefined): string {
  if (!dob || dob.length !== 10) return '****';
  return `**-**-${dob.slice(-4)}`;
}

type panNsdlBody = {
  input: {
    panNumber: string;
    name: string;
    dob: string;
    consent: boolean;
  };
};

type panNsdlResponse = {
  result?: {
    matched?: boolean;
    name?: string;
    panNumber?: string;
    [k: string]: unknown;
  };
  data?: {
    matched?: boolean;
    name?: string;
    [k: string]: unknown;
  };
  status?: string;
  [k: string]: unknown;
};

export type VerifyPanResult = {
  success: true;
  matched: boolean;
  panVerified: boolean;
  vendorFullName: string | null;
};

/**
 * Persists PAN + name + DOB on `lead_detail` and verifies the PAN against
 * NSDL via Tenacio. Each vendor call is recorded in `vendor_api_log` by
 * `VendorApiService` (provider, service, path, method, payloads, status,
 * timings).
 *
 * If the vendor call fails for any reason — missing creds, network error,
 * non-2xx — we still save the user-supplied details and return
 * `panVerified=false`. The user proceeds without being held up by vendor
 * outages; ops can audit the failed call from `vendor_api_log`.
 */
@Injectable()
export class VerifyPanUseCase {
  private readonly logger = new Logger(VerifyPanUseCase.name);
  
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly vendorApi: VendorApiService,
  ) {}

  async execute(req: Request, dto: VerifyPanDto): Promise<VerifyPanResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const leadRow = dto.leadUuid
      ? await this.leads.findByUuidForCustomer(undefined, dto.leadUuid, customer.id)
      : await this.leads.findActiveSummaryForCustomer(undefined, customer.id);

    if (!leadRow) {
      throw new NotFoundException('No matching active lead was found.');
    }

    const panUpper = dto.panNumber.trim().toUpperCase();
    const fullNameTrimmed = dto.fullName.trim();
    const dateOfBirth = parseDobUtc(dto.dob);

    // Save user-supplied details first so the work isn't lost on vendor flake.
    await this.prisma.client.leadDetail.upsert({
      where: { leadId: leadRow.id },
      create: {
        leadId: leadRow.id,
        panNumber: panUpper,
        fullName: fullNameTrimmed,
        dateOfBirth,
      },
      update: {
        panNumber: panUpper,
        fullName: fullNameTrimmed,
        dateOfBirth,
      },
    });

    const verification = await this.callPanVerificationNsdl({
      leadId: leadRow.id,
      panNumber: panUpper,
      fullName: fullNameTrimmed,
      dobIso: dto.dob,
    });

    if (verification.panVerified) {
      await this.prisma.client.leadDetail.update({
        where: { leadId: leadRow.id },
        data: {
          panVerified: true,
          panVerifiedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      matched: verification.matched,
      panVerified: verification.panVerified,
      vendorFullName: verification.vendorFullName,
    };
  }

  /**
   * POST `${VENDOR_HOST}/pan-nsdl`. All four values come from the environment
   * (see `backend/.env.example`):
   *   - `VENDOR_HOST` base URL ending in `…/api/v1/services`
   *   - `TENACIO_CLIENT_ID` `client-id` header
   *   - `TENACIO_API_KEY` `x-api-key` header
   *   - `TENACIO_PAN_NSDL_WORKFLOW_ID` `workflow-id` header (sandbox vs prod
   *                                       differ — never hardcode)
   *
   * Returns a small projection rather than the raw response so the calling
   * use-case isn't coupled to vendor schema drift.
   */
  private async callPanVerificationNsdl(args: {
    leadId: bigint;
    panNumber: string;
    fullName: string;
    dobIso: string;
  }): Promise<{ panVerified: boolean; matched: boolean; vendorFullName: string | null }> {
    // Contract: never throw. Vendor outages, missing env, schema drift, or
    // unexpected bugs in this code path should degrade to "panVerified=false"
    // so the user isn't blocked. Audit trail still lands in vendor_api_log.
    const unverified = { panVerified: false, matched: false, vendorFullName: null };

    try {
      const baseUrl = (process.env.VENDOR_HOST ?? '').trim();
      const clientId = (process.env.TENACIO_CLIENT_ID ?? '').trim();
      const apiKey = (process.env.TENACIO_API_KEY ?? '').trim();
      const workflowId = (process.env.TENACIO_PAN_NSDL_WORKFLOW_ID ?? '').trim();

      if (!baseUrl || !clientId || !apiKey || !workflowId) {
        this.logger.warn(
          'Tenacio credentials missing — skipping PAN verification (set VENDOR_HOST/TENACIO_CLIENT_ID/TENACIO_API_KEY/TENACIO_PAN_NSDL_WORKFLOW_ID in backend/.env).',
        );
        return unverified;
      }

      const result = await this.vendorApi.request<panNsdlResponse, panNsdlBody>({
        providerName: (process.env.TENACIO_PROVIDER ?? '').trim(),
        serviceName: (process.env.TENACIO_PAN_NSDL_SERVICE ?? '').trim(),
        method: 'POST',
        baseUrl,
        path: (process.env.TENACIO_PAN_NSDL_SERVICE ?? '').trim(),
        headers: {
          'client-id': clientId,
          'x-api-key': apiKey,
          'workflow-id': workflowId,
        },
        body: {
          input: {
            panNumber: args.panNumber,
            name: args.fullName,
            dob: formatDobDdMmYyyy(args.dobIso),
            consent: true,
          },
        },
        leadId: args.leadId,
        // Mask PAN + DOB before they hit `vendor_api_log`. Adjust the policy
        // here if your compliance posture allows full payload retention.
        redactRequest: (body) => ({
          ...body,
          input: {
            ...body?.input,
            panNumber: maskPanForAudit(body?.input?.panNumber),
            dob: maskDobForAudit(body?.input?.dob),
          },
        }),
      });

      if (!result.ok || !result.body) {
        return unverified;
      }

      const payload = result.body.result ?? result.body.data ?? null;
      const vendorFullName =
        payload && typeof payload === 'object' && typeof payload.name === 'string' ? payload.name : null;
      const matched =
        payload && typeof payload === 'object' && payload.matched === true ? true : false;

      // Treat any 2xx as "PAN exists in NSDL". Stricter callers can require
      // `matched === true` before letting the user advance.
      return {
        panVerified: true,
        matched,
        vendorFullName,
      };
    } catch (err) {
      // Defence in depth: VendorApiService already catches network/timeout
      // errors, but a bug in redactRequest or a future code path could still
      // throw here. We refuse to let the user's flow break over it.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `PAN verification skipped after unexpected error (leadId=${args.leadId.toString()}): ${message}`,
      );
      return unverified;
    }
  }
}

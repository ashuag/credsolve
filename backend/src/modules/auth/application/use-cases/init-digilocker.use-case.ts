import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { resolveDigilockerRedirectUrl } from '../../../../common/vendor/digilocker-redirect.util';
import {
  extractDigilockerLoginUrl,
  extractDigilockerSessionToken,
} from '../../../../common/vendor/digilocker-response.util';
import { DigilockerSessionStore } from '../../../../common/kyc/digilocker-session.store';
import { DigilockerVendorService } from '../../../../common/vendor/digilocker-vendor.service';
import { assertApplicationKycNotCompleted } from '../../../../common/kyc/application-kyc-guard.util';
import { assertActiveApplicationLoanDocumentsAccepted } from '../../../../common/loan-documents/application-loan-documents-guard.util';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { ApplicationRepository } from '../../infrastructure/repositories/application.repository';
import type { InitDigilockerDto } from '../dto/init-digilocker.dto';

export type InitDigilockerResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  /** Parsed from vendor JSON when present — send the user here to complete DigiLocker login. */
  digilockerLoginUrl: string | null;
  /** Parsed from vendor JSON when present — use with POST /auth/digilocker/download-aadhaar. */
  sessionToken: string | null;
};

@Injectable()
export class InitDigilockerUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly applications: ApplicationRepository,
    private readonly digilocker: DigilockerVendorService,
    private readonly digilockerSession: DigilockerSessionStore,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request, dto: InitDigilockerDto): Promise<InitDigilockerResult> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const lead = await this.leads.findActiveByCustomerId(customer.id);
    if (!lead) {
      throw new BadRequestException('No active loan application was found for your account.');
    }

    const application = await this.applications.ensureDraftApplicationForLead({
      leadId: lead.id,
      customerId: customer.id,
    });
    const appKyc = await this.prisma.client.applicationKyc.findUnique({
      where: { applicationId: application.id },
      select: { kycStatus: true },
    });
    assertApplicationKycNotCompleted(appKyc?.kycStatus);
    await assertActiveApplicationLoanDocumentsAccepted(this.prisma.client, {
      leadId: lead.id,
      customerId: customer.id,
    });

    const redirectUrl = resolveDigilockerRedirectUrl(dto.redirectUrl);

    const out = await this.digilocker.postGenerateUrl(
      { input: { redirectUrl, consent: true } },
      lead.id,
    );

    const vendor = out.vendorBody ?? null;
    const sessionToken = extractDigilockerSessionToken(vendor);
    if (out.ok && sessionToken) {
      await this.digilockerSession.save(application.uuid, sessionToken);
    }
    return {
      configured: out.configured,
      skipReason: out.skipReason,
      ok: out.ok,
      httpStatus: out.httpStatus,
      vendor,
      digilockerLoginUrl: extractDigilockerLoginUrl(vendor),
      sessionToken,
    };
  }
}

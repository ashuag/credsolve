import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BureauFetchService } from '../../../common/vendor/bureau-fetch.service';
import {
  isTenacioBureauClientError,
  isTenacioBureauSuccessPayload,
  parseTenacioBureauEnvelope,
  parseTenacioBureauVendorBody,
} from '../../../common/vendor/tenacio-bureau-payload.mapper';
import { PrismaService } from '../../../prisma/prisma.service';
import { BureauReportPdfService } from '../../../common/cibil/bureau-report-pdf.service';
import { BureauReportRepository } from '../../auth/infrastructure/repositories/bureau-report.repository';
import type { FetchBureauDto } from './dto/fetch-bureau.dto';

@Injectable()
export class FetchBureauUseCase {
  private readonly logger = new Logger(FetchBureauUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bureauFetch: BureauFetchService,
    private readonly bureauReports: BureauReportRepository,
    private readonly bureauReportPdf: BureauReportPdfService,
  ) {}

  async execute(req: Request, dto: FetchBureauDto) {
    const leadId = await this.resolveLeadIdForActor(req, dto.leadUuid);

    const out = await this.bureauFetch.fetchBureauFromTenacio(
      {
        input: {
          mobileNumber: dto.input.mobileNumber,
          name: dto.input.name,
          panNumber: dto.input.panNumber,
          consent: dto.input.consent,
        },
      },
      leadId,
    );

    if (!out.configured) {
      return {
        success: false,
        configured: false,
        message: out.skipReason ?? 'Vendor not configured',
        leadId: leadId?.toString() ?? null,
        httpStatus: null,
        vendor: null,
      };
    }

    const vendorBody = out.vendorBody;
    const successPayload = vendorBody != null && isTenacioBureauSuccessPayload(vendorBody);

    if (leadId != null && vendorBody != null && (successPayload || out.isNewToCredit)) {
      const lead = await this.prisma.client.lead.findUnique({
        where: { id: leadId },
        select: { customerId: true, customer: { select: { uuid: true } } },
      });
      if (lead) {
        try {
          const parsed = parseTenacioBureauVendorBody(vendorBody);
          const created = await this.bureauReports.createFromVendorSnapshot({
            customerId: lead.customerId,
            leadId,
            vendorBody,
            parsed,
            httpStatus: out.httpStatus,
            dummyFetched: out.dummyPayload,
            vendorKind: out.vendorKind,
          });
          await this.bureauReportPdf.generateAndAttachForReport({
            bureauReportId: created.id,
            customerUuid: lead.customer.uuid,
            bureauReportUuid: created.uuid,
            vendorBody,
          });
        } catch (err) {
          this.logger.warn(
            `BureauReport not saved (leadId=${leadId.toString()}): ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    const envelope = out.vendorBody != null ? parseTenacioBureauEnvelope(out.vendorBody) : null;
    const bureauClientError =
      envelope != null && isTenacioBureauClientError(envelope.serviceStatusCode);

    return {
      success:
        out.isNewToCredit ||
        (out.ok && !bureauClientError && (vendorBody == null || successPayload)),
      configured: true,
      leadId: leadId?.toString() ?? null,
      httpStatus: out.httpStatus,
      serviceStatusCode: envelope?.serviceStatusCode ?? null,
      serviceErrorMessage: envelope?.serviceErrorMessage ?? null,
      bureauClientError,
      vendor: out.vendorBody,
      transportError: out.error?.message ?? null,
    };
  }

  private async resolveLeadIdForActor(req: Request, leadUuid: string | undefined): Promise<bigint | null> {
    if (req.losUser) {
      if (!leadUuid?.trim()) {
        throw new BadRequestException('leadUuid is required for LOS bureau requests (vendor audit linkage).');
      }
      const lead = await this.prisma.client.lead.findUnique({
        where: { uuid: leadUuid.trim() },
        select: { id: true },
      });
      if (!lead) {
        throw new NotFoundException('Lead not found for the given leadUuid.');
      }
      return lead.id;
    }

    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.prisma.client.customer.findUnique({
      where: { uuid: session.sub },
      select: { id: true },
    });
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    if (leadUuid?.trim()) {
      const lead = await this.prisma.client.lead.findFirst({
        where: { uuid: leadUuid.trim(), customerId: customer.id, isActive: true },
        select: { id: true },
      });
      if (!lead) {
        throw new NotFoundException('No matching active lead was found for this customer.');
      }
      return lead.id;
    }

    const active = await this.prisma.client.lead.findFirst({
      where: { customerId: customer.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!active) {
      throw new NotFoundException('No active lead found for this customer.');
    }
    return active.id;
  }
}

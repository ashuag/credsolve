import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CibilFetchService } from '../../../common/vendor/cibil-fetch.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { FetchCibilDto } from './dto/fetch-cibil.dto';

@Injectable()
export class FetchCibilUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cibilFetch: CibilFetchService,
  ) {}

  async execute(req: Request, dto: FetchCibilDto) {
    const leadId = await this.resolveLeadIdForActor(req, dto.leadUuid);

    const out = await this.cibilFetch.fetchFromTenacio(
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

    return {
      success: out.ok,
      configured: true,
      leadId: leadId?.toString() ?? null,
      httpStatus: out.httpStatus,
      vendor: out.vendorBody,
      transportError: out.error?.message ?? null,
    };
  }

  private async resolveLeadIdForActor(req: Request, leadUuid: string | undefined): Promise<bigint | null> {
    if (req.losUser) {
      if (!leadUuid?.trim()) {
        throw new BadRequestException('leadUuid is required for LOS CIBIL requests (vendor audit linkage).');
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

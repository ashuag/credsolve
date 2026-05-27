import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { SaveLeadReferencesDto } from '../dto/save-lead-references.dto';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

@Injectable()
export class SaveLeadReferencesUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(req: Request, dto: SaveLeadReferencesDto): Promise<{ success: true; leadUuid: string }> {
    const session = req.customerSession;
    if (!session) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    const leadRow = dto.leadUuid
      ? await this.leads.findByUuidForCustomer(dto.leadUuid, customer.id)
      : await this.leads.findActiveSummaryForCustomer(customer.id);

    if (!leadRow) {
      throw new NotFoundException('No matching active lead was found.');
    }

    const customerMobile = customer.mobileNumber.trim();
    const refs = dto.references.map((ref, index) => {
      const fullName = ref.fullName.trim();
      const mobileNumber = ref.mobileNumber.trim();
      if (!INDIAN_MOBILE.test(mobileNumber)) {
        throw new BadRequestException(`Reference ${index + 1}: enter a valid 10-digit mobile number.`);
      }
      if (mobileNumber === customerMobile) {
        throw new BadRequestException(`Reference ${index + 1}: use a number other than your own mobile.`);
      }
      return {
        referenceIndex: index + 1,
        fullName,
        mobileNumber,
        relationId: ref.relationId,
      };
    });

    const mobiles = refs.map((ref) => ref.mobileNumber);
    if (new Set(mobiles).size !== mobiles.length) {
      throw new BadRequestException('Each reference must have a different mobile number.');
    }

    const relationIds = [...new Set(refs.map((ref) => ref.relationId))];
    const activeRelations = await this.prisma.client.referenceRelation.findMany({
      where: { id: { in: relationIds }, isActive: true },
      select: { id: true },
    });
    if (activeRelations.length !== relationIds.length) {
      throw new BadRequestException('One or more relation options are invalid.');
    }

    await this.prisma.client.$transaction(
      refs.map((ref) =>
        this.prisma.client.leadReference.upsert({
          where: {
            leadId_referenceIndex: {
              leadId: leadRow.id,
              referenceIndex: ref.referenceIndex,
            },
          },
          create: {
            leadId: leadRow.id,
            referenceIndex: ref.referenceIndex,
            fullName: ref.fullName,
            mobileNumber: ref.mobileNumber,
            relationId: ref.relationId,
          },
          update: {
            fullName: ref.fullName,
            mobileNumber: ref.mobileNumber,
            relationId: ref.relationId,
          },
        }),
      ),
    );

    return { success: true, leadUuid: leadRow.uuid };
  }
}

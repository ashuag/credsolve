import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { APPLICATION_STATUS } from '../../../../common/constants/application.constants';
import { personNamesMatch } from '../../../../common/kyc/aadhaar-lead-identity-match.util';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { SaveLeadReferencesDto } from '../dto/save-lead-references.dto';

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

function last10Digits(raw: string): string {
  return raw.replace(/\D/g, '').slice(-10);
}

@Injectable()
export class SaveLeadReferencesUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    req: Request,
    dto: SaveLeadReferencesDto,
  ): Promise<{ success: true; leadUuid: string; needsSanctionOtp: boolean }> {
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

    const customerMobile = last10Digits(customer.mobileNumber);
    const customerName = leadRow.leadDetail?.fullName?.trim() ?? '';
    const refs = dto.references.map((ref, index) => {
      const fullName = ref.fullName.trim();
      const mobileNumber = last10Digits(ref.mobileNumber);
      if (!INDIAN_MOBILE.test(mobileNumber)) {
        throw new BadRequestException(`Reference ${index + 1}: enter a valid 10-digit mobile number.`);
      }
      if (customerName && personNamesMatch(fullName, customerName)) {
        throw new BadRequestException(
          `Reference ${index + 1}: name cannot match your name.`,
        );
      }
      if (mobileNumber === customerMobile) {
        throw new BadRequestException(
          `Reference ${index + 1}: mobile number cannot match your mobile number.`,
        );
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

    const { accepted } = await this.prisma.client.$transaction(async (tx) => {
      const application = await tx.application.findFirst({
        where: { leadId: leadRow.id, customerId: customer.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          applicationStatus: { select: { name: true } },
          details: {
            select: {
              loanDocumentsAcceptedAt: true,
            },
          },
        },
      });
      if (!application) {
        throw new BadRequestException('Complete loan selection before adding references.');
      }
      if (application.applicationStatus.name === APPLICATION_STATUS.UNDER_REVIEW) {
        throw new BadRequestException(
          'Your bank account name is under credit review. You can add references after it is approved.',
        );
      }

      const reviewedRows = await tx.$queryRaw<Array<{ loanDocumentsReviewedAt: Date | null }>>`
        SELECT loan_documents_reviewed_at AS loanDocumentsReviewedAt
        FROM application_detail
        WHERE application_id = ${application.id}
        LIMIT 1
      `;
      if (!reviewedRows[0]?.loanDocumentsReviewedAt) {
        throw new BadRequestException('Review the sanction letter before adding references.');
      }

      await Promise.all(
        refs.map((ref) =>
          tx.applicationReference.upsert({
            where: {
              applicationId_referenceIndex: {
                applicationId: application.id,
                referenceIndex: ref.referenceIndex,
              },
            },
            create: {
              applicationId: application.id,
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

      return {
        accepted: application.details?.loanDocumentsAcceptedAt != null,
      };
    });

    return { success: true, leadUuid: leadRow.uuid, needsSanctionOtp: !accepted };
  }
}

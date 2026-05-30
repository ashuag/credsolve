import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { REJECTION_REASON } from '../../../../common/constants/rejection-reason.constants';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../repositories/customer.repository';
import { LeadRepository } from '../repositories/lead.repository';
import type { RejectPanClientValidationDto } from '../dto/reject-pan-client-validation.dto';

const PAN_CLIENT_VALIDATION_NOTE = 'Pan number is not corrected';

@Injectable()
export class RejectPanClientValidationUseCase {
  private readonly logger = new Logger(RejectPanClientValidationUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
  ) {}

  async execute(req: Request, dto: RejectPanClientValidationDto): Promise<{ success: true; rejected: true }> {
    const session = req.customerSession;
    if (!session) throw new UnauthorizedException('Sign in with mobile OTP before continuing.');

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) throw new UnauthorizedException('Customer not found.');

    const leadRow = dto.leadUuid
      ? await this.leads.findByUuidForCustomer(dto.leadUuid, customer.id)
      : await this.leads.findActiveSummaryForCustomer(customer.id);

    if (!leadRow) throw new NotFoundException('No matching active lead was found.');

    const [rejectedStatus, rejectionReason] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      (this.prisma.client as any).rejectionReason.findFirst({
        where: { name: REJECTION_REASON.PAN_VERIFICATION_FAILED, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!rejectedStatus) {
      this.logger.warn('LeadStatus REJECTED not found — skipping PAN client validation rejection.');
      return { success: true, rejected: true };
    }

    await this.leads.updateLead({
      where: { id: leadRow.id },
      data: {
        leadStatusId: rejectedStatus.id,
        leadStatusNote: PAN_CLIENT_VALIDATION_NOTE,
        ...(rejectionReason ? { rejectionReasonId: rejectionReason.id } : {}),
      },
    });

    this.logger.log(`Lead ${leadRow.id.toString()} rejected via client PAN validation failure.`);
    return { success: true, rejected: true };
  }
}

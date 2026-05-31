import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { REJECTION_REASON } from '../../../../common/constants/rejection-reason.constants';
import { SettingKey } from '../../../../common/constants/setting.constants';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository'; // kept for findByUuid/findActiveSummary
import type { RejectPanClientValidationDto } from '../dto/reject-pan-client-validation.dto';

const PAN_CLIENT_VALIDATION_NOTE = 'Pan number is not corrected';

export type RejectPanClientValidationResult =
  | { success: true; rejected: false; attemptsUsed: number; attemptsAllowed: number }
  | { success: true; rejected: true };

@Injectable()
export class RejectPanClientValidationUseCase {
  private readonly logger = new Logger(RejectPanClientValidationUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
  ) {}

  async execute(req: Request, dto: RejectPanClientValidationDto): Promise<RejectPanClientValidationResult> {
    const session = req.customerSession;
    if (!session) throw new UnauthorizedException('Sign in with mobile OTP before continuing.');

    const customer = await this.customers.findByUuid(undefined, session.sub);
    if (!customer) throw new UnauthorizedException('Customer not found.');

    const leadRow = dto.leadUuid
      ? await this.leads.findByUuidForCustomer(dto.leadUuid, customer.id)
      : await this.leads.findActiveSummaryForCustomer(customer.id);

    if (!leadRow) throw new NotFoundException('No matching active lead was found.');

    const attemptsAllowed = await this.loadMaxAttempts();
    const rows = await this.prisma.client.$queryRaw<Array<{ pan_validation_attempts: number }>>`
      SELECT \`pan_validation_attempts\` FROM \`lead\` WHERE \`id\` = ${leadRow.id} LIMIT 1
    `;
    const attemptsUsed = Number(rows[0]?.pan_validation_attempts ?? 0) + 1;

    await this.prisma.client.$executeRaw`
      UPDATE \`lead\` SET \`pan_validation_attempts\` = ${attemptsUsed} WHERE \`id\` = ${leadRow.id}
    `;

    if (attemptsUsed < attemptsAllowed) {
      this.logger.log(
        `Lead ${leadRow.id.toString()} PAN client validation attempt ${attemptsUsed}/${attemptsAllowed} — retry allowed.`,
      );
      return { success: true, rejected: false, attemptsUsed, attemptsAllowed };
    }

    await this.prisma.client.$executeRaw`
      UPDATE \`lead\` l
      JOIN \`lead_status\` ls ON ls.name = ${LEAD_STATUS.REJECTED} AND ls.is_active = 1
      LEFT JOIN \`rejection_reason\` rr ON rr.name = ${REJECTION_REASON.PAN_VERIFICATION_FAILED} AND rr.is_active = 1
      SET l.lead_status_id = ls.id,
          l.rejection_reason_id = rr.id,
          l.lead_status_note = ${PAN_CLIENT_VALIDATION_NOTE}
      WHERE l.id = ${leadRow.id}
    `;

    this.logger.log(
      `Lead ${leadRow.id.toString()} rejected after ${attemptsUsed} PAN client validation attempts.`,
    );
    return { success: true, rejected: true };
  }

  private async loadMaxAttempts(): Promise<number> {
    const row = await this.prisma.client.setting.findFirst({
      where: { key: SettingKey.PAN_VALIDATION_ATTEMPTS.key, isActive: true },
      select: { value: true },
    });
    const n = row ? Number.parseInt(row.value.trim(), 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : Number.parseInt(SettingKey.PAN_VALIDATION_ATTEMPTS.default, 10);
  }
}

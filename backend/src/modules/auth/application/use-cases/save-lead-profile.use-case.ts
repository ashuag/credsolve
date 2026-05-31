import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { GENDER } from '../../../../common/constants/gender.constants';
import { OCCUPATION } from '../../../../common/constants/occupation.constants';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { REJECTION_REASON } from '../../../../common/constants/rejection-reason.constants';
import { SettingKey } from '../../../../common/constants/setting.constants';
import { parseOptionalInrAmount } from '../../../../common/utils/parse-inr-amount';

const GENDER_KEY_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.values(GENDER).map(({ key, name }) => [key, name]),
);
const OCCUPATION_KEY_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.values(OCCUPATION).map(({ key, name }) => [key, name]),
);
import { PanVerificationService } from '../../../../common/vendor/pan-verification.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import type { SaveLeadProfileDto } from '../dto/save-lead-profile.dto';

function parseDobUtc(dob: string): Date {
  const [y, m, d] = dob.split('-').map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new BadRequestException('Invalid date of birth.');
  }
  return new Date(Date.UTC(y, m - 1, d));
}

@Injectable()
export class SaveLeadProfileUseCase {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly panVerification: PanVerificationService,
  ) {}

  async execute(req: Request, dto: SaveLeadProfileDto): Promise<{ success: true; leadUuid: string } | { success: false; rejected: true }> {
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

    const genderName = GENDER_KEY_TO_NAME[dto.gender];
    const occupationName = OCCUPATION_KEY_TO_NAME[dto.occupation];
    if (!genderName || !occupationName) {
      throw new BadRequestException('Invalid gender or occupation.');
    }

    const [gender, occupation] = await Promise.all([
      this.prisma.client.gender.findUnique({ where: { name: genderName }, select: { id: true } }),
      this.prisma.client.occupation.findUnique({ where: { name: occupationName }, select: { id: true } }),
    ]);

    if (!gender || !occupation) {
      throw new BadRequestException('Gender or occupation is not available in the system.');
    }

    const dateOfBirth = parseDobUtc(dto.dob);
    const netMonthlyIncome = parseOptionalInrAmount(dto.monthlyIncome);
    const annualTurnover = parseOptionalInrAmount(dto.annualTurnover);
    const annualProfit = parseOptionalInrAmount(dto.annualProfit);
    const panUpper = dto.panNumber.trim().toUpperCase();

    const profilePayload = {
      fullName: dto.fullName.trim(),
      dateOfBirth,
      genderId: gender.id,
      occupationId: occupation.id,
      netMonthlyIncome,
      annualTurnover,
      annualProfit,
      ...(dto.creditConsentAccepted === true ? { cibilConsentAt: new Date() } : {}),
    };

    await this.prisma.client.leadDetail.upsert({
      where: { leadId: leadRow.id },
      create: {
        leadId: leadRow.id,
        ...profilePayload,
      },
      update: profilePayload,
    });

    await this.prisma.client.lead.update({
      where: { id: leadRow.id },
      data: { panNumber: panUpper },
    });

    const panCheck = this.panVerification.validatePanStructure(panUpper, dto.fullName.trim());
    if (!panCheck.valid) {
      const maxAttempts = await this.loadMaxPanAttempts();
      const currentAttempts = await this.fetchPanAttempts(leadRow.id);
      const attemptsUsed = currentAttempts + 1;

      await this.prisma.client.$executeRaw`
        UPDATE \`lead\` SET \`pan_validation_attempts\` = ${attemptsUsed} WHERE \`id\` = ${leadRow.id}
      `;

      if (attemptsUsed >= maxAttempts) {
        await this.prisma.client.$executeRaw`
          UPDATE \`lead\` l
          JOIN \`lead_status\` ls ON ls.name = ${LEAD_STATUS.REJECTED} AND ls.is_active = 1
          LEFT JOIN \`rejection_reason\` rr ON rr.name = ${REJECTION_REASON.PAN_VERIFICATION_FAILED} AND rr.is_active = 1
          SET l.lead_status_id = ls.id,
              l.rejection_reason_id = rr.id,
              l.lead_status_note = 'pan not verified, failed in initial check'
          WHERE l.id = ${leadRow.id}
        `;
        return { success: false, rejected: true };
      }

      const remaining = maxAttempts - attemptsUsed;
      throw new BadRequestException(
        `Please enter a valid PAN number. You have ${remaining} attempt(s) remaining.`,
      );
    }

    return { success: true, leadUuid: leadRow.uuid };
  }

  private async fetchPanAttempts(leadId: bigint): Promise<number> {
    const rows = await this.prisma.client.$queryRaw<Array<{ pan_validation_attempts: number }>>`
      SELECT \`pan_validation_attempts\` FROM \`lead\` WHERE \`id\` = ${leadId} LIMIT 1
    `;
    return Number(rows[0]?.pan_validation_attempts ?? 0);
  }

  private async loadMaxPanAttempts(): Promise<number> {
    const row = await this.prisma.client.setting.findFirst({
      where: { key: SettingKey.PAN_VALIDATION_ATTEMPTS.key, isActive: true },
      select: { value: true },
    });
    const n = row ? Number.parseInt(row.value.trim(), 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : Number.parseInt(SettingKey.PAN_VALIDATION_ATTEMPTS.default, 10);
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PreBreCheckService } from '../../../../common/bre/pre-bre-check.service';
import { LEAD_STATUS } from '../../../../common/constants/lead.constants';
import { REJECTION_REASON } from '../../../../common/constants/rejection-reason.constants';
import { SettingKey } from '../../../../common/constants/setting.constants';
import { parseOptionalInrAmount } from '../../../../common/utils/parse-inr-amount';
import { throwIfLeadIntakeInvalid, validateOccupationIncome } from '../../../../common/validation/lead-intake.validation';
import { resolveGenderOccupationIds } from '../../../../common/utils/resolve-gender-occupation-ids.util';
import { PanVerificationService } from '../../../../common/vendor/pan-verification.service';
import { SmsService } from '../../../../common/sms/sms.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CustomerRepository } from '../../infrastructure/repositories/customer.repository';
import { LeadRepository } from '../../infrastructure/repositories/lead.repository';
import { SettingsRepository } from '../../infrastructure/repositories/settings.repository';
import { recurringLockedIdentityFromPriorDetail } from '../../../../common/lead/recurring-customer-identity.util';
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
  private readonly logger = new Logger(SaveLeadProfileUseCase.name);

  constructor(
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly panVerification: PanVerificationService,
    private readonly preBreCheck: PreBreCheckService,
    private readonly settings: SettingsRepository,
    private readonly sms: SmsService,
  ) {}

  async execute(
    req: Request,
    dto: SaveLeadProfileDto,
  ): Promise<{ success: true; leadUuid: string } | { success: true; rejected: true }> {
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

    const priorIdentity = recurringLockedIdentityFromPriorDetail(
      await this.leads.findLatestPriorLeadDetailForCustomer(customer.id, leadRow.id),
    );

    const { genderId, occupationId } = await resolveGenderOccupationIds(
      this.prisma.client,
      dto.gender,
      dto.occupation,
    );

    throwIfLeadIntakeInvalid(
      validateOccupationIncome(dto.occupation, {
        monthlyIncome: parseOptionalInrAmount(dto.monthlyIncome)?.toNumber() ?? null,
        annualTurnover: parseOptionalInrAmount(dto.annualTurnover)?.toNumber() ?? null,
        annualProfit: parseOptionalInrAmount(dto.annualProfit)?.toNumber() ?? null,
      }),
    );

    const dateOfBirth = priorIdentity?.dateOfBirth ?? parseDobUtc(dto.dob);
    const resolvedGenderId = priorIdentity?.genderId ?? genderId;
    const netMonthlyIncome = parseOptionalInrAmount(dto.monthlyIncome);
    const annualTurnover = parseOptionalInrAmount(dto.annualTurnover);
    const annualProfit = parseOptionalInrAmount(dto.annualProfit);
    const panUpper = priorIdentity?.panNumber ?? dto.panNumber.trim().toUpperCase();

    const profilePayload = {
      fullName: priorIdentity?.fullName ?? dto.fullName.trim(),
      dateOfBirth,
      genderId: resolvedGenderId,
      occupationId,
      netMonthlyIncome,
      annualTurnover,
      annualProfit,
      panNumber: panUpper,
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

    const breSettings = await this.settings.loadBreSettings();
    const preBreResult = await this.preBreCheck.run(
      {
        dateOfBirth,
        genderId: resolvedGenderId,
        occupationId,
        genderDisplay: dto.gender,
        occupationDisplay: dto.occupation,
        pincode: null,
        cityId: null,
        stateId: null,
        cityName: null,
        stateCode: null,
      },
      breSettings,
    );
    if (!preBreResult.passed) {
      this.logger.log(
        `Pre-BRE rejected lead ${leadRow.id.toString()} before PAN verification: ${preBreResult.rejectionReasonCode ?? 'unknown'}`,
      );
      await this.rejectLead(
        leadRow.id,
        preBreResult.rejectReason ?? 'BRE check failed',
        preBreResult.rejectionReasonCode,
      );
      void this.sms.sendRejectionSms(customer.mobileNumber, leadRow.id).catch((err) => {
        this.logger.error('Failed to send rejection SMS', err instanceof Error ? err.stack : err);
      });
      return { success: true, rejected: true };
    }

    const panCheck = this.panVerification.validatePanStructure(panUpper, dto.fullName.trim());
    if (!panCheck.valid) {
      const maxAttempts = await this.loadMaxPanAttempts();
      const currentAttempts = await this.fetchPanAttempts(leadRow.id);
      const attemptsUsed = currentAttempts + 1;

      await this.prisma.client.$executeRaw`
        UPDATE \`lead_detail\` SET \`pan_validation_attempts\` = ${attemptsUsed} WHERE \`lead_id\` = ${leadRow.id}
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
        void this.sms.sendRejectionSms(customer.mobileNumber, leadRow.id).catch((err) => {
          this.logger.error('Failed to send rejection SMS', err instanceof Error ? err.stack : err);
        });
        return { success: true, rejected: true };
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
      SELECT \`pan_validation_attempts\` FROM \`lead_detail\` WHERE \`lead_id\` = ${leadId} LIMIT 1
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

  private async rejectLead(leadId: bigint, note: string, rejectionReasonCode?: string | null) {
    const [rejected, reason] = await Promise.all([
      this.prisma.client.leadStatus.findFirst({
        where: { name: LEAD_STATUS.REJECTED, isActive: true },
        select: { id: true },
      }),
      rejectionReasonCode
        ? this.prisma.client.rejectionReason.findFirst({
            where: { name: rejectionReasonCode, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!rejected) {
      this.logger.warn('LeadStatus REJECTED not found in DB — skipping lead rejection.');
      return;
    }
    await this.leads.updateLead({
      where: { id: leadId },
      data: {
        leadStatusId: rejected.id,
        leadStatusNote: note.slice(0, 256),
        ...(reason ? { rejectionReasonId: reason.id } : {}),
      },
    });
  }
}

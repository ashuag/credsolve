import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationService } from '../../application/services/application.service';
import { CurrentCustomer } from '../../auth/decorators/current-customer.decorator';
import { CustomerJwtGuard } from '../../auth/guards/customer-jwt.guard';
import { type CustomerJwtPayload } from '../../auth/services/customer-auth.service';
import { SaveLeadDetailsDto } from '../dto/inputDto/save-lead-details.dto';
import { SyncLeadEmailDto } from '../dto/inputDto/sync-lead-email.dto';
import { LeadService } from '../services/lead.service';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('leads')
export class CustomerLeadController {
  constructor(
    private readonly leadService: LeadService,
    private readonly applicationService: ApplicationService
  ) {}

  @ApiOperation({ summary: 'Sync the authenticated customer email on their current lead' })
  @Post('email')
  async syncLeadEmail(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() dto: SyncLeadEmailDto
  ) {
    const leadUuid = await this.leadService.syncEmailForCustomer({
      customerUuid: customer.sub,
      mobileNumber: customer.mobileNumber,
      leadUuid: dto.leadUuid,
      email: dto.email,
      emailVerified: dto.emailVerified,
      verificationType: dto.verificationType
    });

    return {
      success: true,
      ...(leadUuid ? { leadUuid } : {})
    };
  }

  @ApiOperation({ summary: 'Get the latest lead status for the authenticated customer' })
  @Get('status')
  async getLeadStatus(@CurrentCustomer() customer: CustomerJwtPayload) {
    const lead = await this.leadService.findLatestStateForCustomer({
      customerUuid: customer.sub,
      mobileNumber: customer.mobileNumber
    });

    return {
      leadId: lead?.uuid ?? null,
      leadStatus: lead?.leadStatus ?? null
    };
  }

  @ApiOperation({ summary: 'Save onboarding customer details for the authenticated customer lead' })
  @Post('details')
  async saveLeadDetails(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() dto: SaveLeadDetailsDto
  ) {
    const leadUuid = await this.applicationService.saveOnboardingDetails({
      customerUuid: customer.sub,
      mobileNumber: customer.mobileNumber,
      leadUuid: dto.leadUuid,
      fullName: dto.fullName,
      dob: dto.dob,
      gender: dto.gender,
      occupation: dto.occupation,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      currentCity: dto.currentCity,
      pincode: dto.pincode,
      monthlyIncome: dto.monthlyIncome,
      annualTurnover: dto.annualTurnover,
      annualProfit: dto.annualProfit,
      creditConsentAccepted: dto.creditConsentAccepted
    });

    return {
      success: true,
      ...(leadUuid ? { leadUuid } : {})
    };
  }
}

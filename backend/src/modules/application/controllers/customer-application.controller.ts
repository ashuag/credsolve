import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../../auth/decorators/current-customer.decorator';
import { CustomerJwtGuard } from '../../auth/guards/customer-jwt.guard';
import { type CustomerJwtPayload } from '../../auth/services/customer-auth.service';
import { SaveApplicationDetailsDto } from '../dto/inputDto/save-application-details.dto';
import { SaveLoanOfferDto } from '../dto/inputDto/save-loan-offer.dto';
import { SaveProfessionalDetailsDto } from '../dto/inputDto/save-professional-details.dto';
import { ApplicationService } from '../services/application.service';
import { type PanVerificationStatus } from '../services/pan-verification.service';

@ApiTags('Applications')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('applications')
export class CustomerApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @ApiOperation({ summary: 'Get the current eligible loan offer for the authenticated customer' })
  @Get('offer')
  async getLoanOffer(@CurrentCustomer() customer: CustomerJwtPayload) {
    const offer = await this.applicationService.getLoanOffer({
      customerUuid: customer.sub,
      mobileNumber: customer.mobileNumber
    });

    return {
      success: true,
      ...offer
    };
  }

  @ApiOperation({ summary: 'Save basic KYC details, advance lead to DETAIL_STARTED, verify PAN' })
  @Post('details')
  async saveApplicationDetails(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() dto: SaveApplicationDetailsDto
  ): Promise<{ success: boolean; leadUuid: string; panResult: { status: PanVerificationStatus } }> {
    const { leadUuid, panResult } = await this.applicationService.saveDetails({
      leadUuid: dto.leadUuid,
      customerUuid: customer.sub,
      mobileNumber: customer.mobileNumber,
      fullName: dto.fullName,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender as 'male' | 'female' | 'others',
      panNumber: dto.panNumber,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      currentCity: dto.currentCity,
      pincode: dto.pincode
    });

    return { success: true, leadUuid, panResult };
  }

  @ApiOperation({ summary: 'Save professional details, run NSDL bureau + eligibility check' })
  @Post('professional-details')
  async saveProfessionalDetails(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() dto: SaveProfessionalDetailsDto
  ) {
    const { leadUuid, eligibility } = await this.applicationService.saveProfessionalDetails({
      leadUuid: dto.leadUuid,
      customerUuid: customer.sub,
      mobileNumber: customer.mobileNumber,
      occupation: dto.occupation,
      monthlyIncome: dto.monthlyIncome,
      annualTurnover: dto.annualTurnover,
      annualProfit: dto.annualProfit
    });

    return {
      success: true,
      leadUuid,
      eligible: eligibility.isEligible,
      approvedAmount: eligibility.approvedAmount ?? null,
      cibilScore: eligibility.cibilScore ?? null,
    };
  }

  @ApiOperation({ summary: 'Save the selected loan offer details and continue to KYC' })
  @Post('offer')
  async saveLoanOffer(
    @CurrentCustomer() customer: CustomerJwtPayload,
    @Body() dto: SaveLoanOfferDto
  ) {
    const { leadUuid } = await this.applicationService.saveLoanOffer({
      leadUuid: dto.leadUuid,
      customerUuid: customer.sub,
      mobileNumber: customer.mobileNumber,
      reasonForLoanId: dto.reasonForLoanId,
      loanAmount: dto.loanAmount
    });

    return {
      success: true,
      leadUuid
    };
  }
}

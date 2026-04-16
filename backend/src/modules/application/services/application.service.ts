import { randomInt, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { type DatabaseSession } from '../../../../prisma/database-session';
import { GENDER } from '../../../common/constants/gender.constants';
import { OCCUPATION } from '../../../common/constants/occupation.constants';
import { SettingKey } from '../../../common/constants/setting.constants';
import { LeadDetailsRepository } from '../../lead/repositories/lead-details.repository';
import { LeadService } from '../../lead/services/lead.service';
import { ApplicationConfigurationException } from '../exceptions/application-configuration.exception';
import { ApplicationDetailsRepository } from '../repositories/application-details.repository';
import { ApplicationEligibilityRepository } from '../repositories/application-eligibility.repository';
import { ApplicationRepository } from '../repositories/application.repository';
import { ApplicationStatusRepository } from '../repositories/application-status.repository';
import { ReasonForLoanRepository } from '../repositories/reason-for-loan.repository';
import { SettingRepository } from '../repositories/setting.repository';
import { type EligibilityResult, EligibilityService } from './eligibility.service';
import { type PanVerificationResult, PanVerificationService } from './pan-verification.service';

const GENDER_NAME_BY_VALUE = {
  male: GENDER.MALE,
  female: GENDER.FEMALE,
  others: GENDER.OTHERS
} as const;

const OCCUPATION_NAME_BY_VALUE = {
  salaried: OCCUPATION.SALARIED,
  self_employed_professional: OCCUPATION.SELF_EMPLOYED_PROFESSIONAL,
  self_employed_business: OCCUPATION.SELF_EMPLOYED_BUSINESS,
  student: OCCUPATION.STUDENT,
  homemaker: OCCUPATION.HOMEMAKER,
  retired: OCCUPATION.RETIRED
} as const;

export type CustomerFlowStage =
  | 'onboarding'
  | 'account'
  | 'professional'
  | 'loan-offer'
  | 'kyc'
  | 'my-account';

type LoanOfferSettings = {
  minLoanAmount: number;
  maxLoanAmount: number;
  loanTenure: number;
  roiPerDay: number;
  processingFee: number;
  processingFeeGst: number;
};

@Injectable()
export class ApplicationService {
  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly applicationDetailsRepository: ApplicationDetailsRepository,
    private readonly applicationStatusRepository: ApplicationStatusRepository,
    private readonly applicationEligibilityRepository: ApplicationEligibilityRepository,
    private readonly reasonForLoanRepository: ReasonForLoanRepository,
    private readonly settingRepository: SettingRepository,
    private readonly leadDetailsRepository: LeadDetailsRepository,
    private readonly leadService: LeadService,
    private readonly panVerificationService: PanVerificationService,
    private readonly eligibilityService: EligibilityService,
  ) {}

  async ensureDraftForLead(params: {
    leadUuid: string;
  }, session?: DatabaseSession): Promise<{ uuid: string; id: bigint }> {
    const existing = await this.applicationRepository.findByLeadUuid(params.leadUuid, session);

    if (existing) {
      return existing;
    }

    const statusId = await this.applicationStatusRepository.findActiveIdByName('DRAFT', session);

    if (!statusId) {
      throw new ApplicationConfigurationException('DRAFT application status not found — run seeds');
    }

    const uuid = randomUUID();
    const customerId = await this.leadService.findCustomerIdByLeadUuid(params.leadUuid, session);

    if (!customerId) {
      throw new ApplicationConfigurationException('Application creation failed — lead not found');
    }

    await this.applicationRepository.create({
      uuid,
      customerId,
      leadUuid: params.leadUuid,
      statusId
    }, session);

    const created = await this.applicationRepository.findByLeadUuid(params.leadUuid, session);

    if (!created) {
      throw new ApplicationConfigurationException('Application creation failed — lead not found');
    }

    return created;
  }

  async saveDetails(params: {
    leadUuid?: string;
    customerUuid: string;
    mobileNumber?: string | null;
    fullName: string;
    dateOfBirth: Date;
    gender: keyof typeof GENDER_NAME_BY_VALUE;
    panNumber: string;
    addressLine1: string;
    addressLine2?: string;
    currentCity: string;
    pincode: string;
  }, session?: DatabaseSession): Promise<{ leadUuid: string; panResult: PanVerificationResult }> {
    const leadUuid = await this.resolveLeadUuid({
      leadUuid: params.leadUuid,
      customerUuid: params.customerUuid,
      mobileNumber: params.mobileNumber
    }, session);

    const application = await this.ensureDraftForLead({ leadUuid }, session);
    const leadId = await this.requireLeadId(leadUuid, session);

    const genderId = await this.leadDetailsRepository.findActiveGenderIdByName(
      GENDER_NAME_BY_VALUE[params.gender],
      session
    );

    if (!genderId) {
      throw new BadRequestException('Selected gender is invalid.');
    }

    const cityId = await this.leadDetailsRepository.findActiveCityIdByName(params.currentCity, session);

    if (!cityId) {
      throw new BadRequestException('Selected city is invalid.');
    }

    await this.leadDetailsRepository.upsertPersonalDetails({
      leadId,
      fullName: params.fullName.trim(),
      dateOfBirth: params.dateOfBirth,
      genderId,
      panNumber: params.panNumber,
      addressLine1: params.addressLine1.trim(),
      addressLine2: params.addressLine2?.trim() || null,
      cityId,
      pincode: params.pincode
    }, session);

    await this.leadService.updateLeadStatusByUuid(leadUuid, 'DETAIL_STARTED', session);

    const panResult = await this.panVerificationService.verify(params.panNumber, params.fullName);

    if (panResult.status === 'verified') {
      const submittedStatusId = await this.applicationStatusRepository.findActiveIdByName('SUBMITTED', session);

      if (!submittedStatusId) {
        throw new ApplicationConfigurationException('SUBMITTED application status not found — run seeds');
      }

      await this.applicationRepository.updateStatusById(application.id, submittedStatusId, session);
    }

    return { leadUuid, panResult };
  }

  async saveProfessionalDetails(params: {
    leadUuid?: string;
    customerUuid: string;
    mobileNumber?: string | null;
    occupation: keyof typeof OCCUPATION_NAME_BY_VALUE;
    monthlyIncome?: string;
    annualTurnover?: string;
    annualProfit?: string;
  }, session?: DatabaseSession): Promise<{ leadUuid: string; eligibility: EligibilityResult }> {
    const leadUuid = await this.resolveLeadUuid({
      leadUuid: params.leadUuid,
      customerUuid: params.customerUuid,
      mobileNumber: params.mobileNumber
    }, session);

    const application = await this.ensureDraftForLead({ leadUuid }, session);
    const leadId = await this.requireLeadId(leadUuid, session);

    const personalDetails = await this.leadDetailsRepository.findPersonalDetailsByLeadId(leadId, session);
    if (!personalDetails?.cityId || !personalDetails.pincode) {
      throw new BadRequestException('Please complete your personal details before continuing.');
    }

    const occupationId = await this.leadDetailsRepository.findActiveOccupationIdByName(
      OCCUPATION_NAME_BY_VALUE[params.occupation],
      session
    );
    if (!occupationId) {
      throw new BadRequestException('Selected occupation is invalid.');
    }

    await this.leadDetailsRepository.upsertProfessionalDetails({
      leadId,
      cityId: personalDetails.cityId,
      pincode: personalDetails.pincode,
      occupationId,
      monthlyIncome: params.monthlyIncome ?? null,
      annualTurnover: params.annualTurnover ?? null,
      annualProfit: params.annualProfit ?? null
    }, session);

    const ageAtApplication = personalDetails.dateOfBirth
      ? this.calculateAge(personalDetails.dateOfBirth)
      : 0;

    const eligibility = await this.eligibilityService.check({
      panNumber: personalDetails.panNumber ?? '',
      fullName: personalDetails.fullName ?? '',
      ageAtApplication,
      isExistingCustomer: false,
    });

    const resolvedEligibility = eligibility.isEligible
      ? {
          ...eligibility,
          approvedAmount: this.generateEligibleLoanAmount(await this.getLoanOfferSettings(session))
        }
      : eligibility;

    await this.applicationEligibilityRepository.upsert({
      applicationId: application.id,
      isEligible: resolvedEligibility.isEligible,
      approvedAmount: resolvedEligibility.approvedAmount,
      cibilScore: resolvedEligibility.cibilScore,
      ineligibleReason: resolvedEligibility.ineligibleReason,
    }, session);

    const targetAppStatus = resolvedEligibility.isEligible ? 'APPROVED' : 'REJECTED';
    const appStatusId = await this.applicationStatusRepository.findActiveIdByName(targetAppStatus, session);
    if (!appStatusId) {
      throw new BadRequestException(`${targetAppStatus} application status not configured — run seeds`);
    }

    await this.applicationRepository.updateStatusById(application.id, appStatusId, session);

    if (!resolvedEligibility.isEligible) {
      await this.leadService.updateLeadStatusByUuid(leadUuid, 'CONVERTED', session);
    }

    return { leadUuid, eligibility: resolvedEligibility };
  }

  async getLoanOffer(params: {
    customerUuid: string;
    mobileNumber?: string | null;
    leadUuid?: string;
  }, session?: DatabaseSession): Promise<{
    leadUuid: string;
    applicationUuid: string;
    eligibleLoanAmount: number;
    minLoanAmount: number;
    maxLoanAmount: number;
    loanTenure: number;
    roiPerDay: number;
    processingFee: number;
    processingFeeGst: number;
    cibilScore: number | null;
    reasons: Array<{ id: number; name: string }>;
  }> {
    const leadUuid = await this.resolveLeadUuid({
      leadUuid: params.leadUuid,
      customerUuid: params.customerUuid,
      mobileNumber: params.mobileNumber
    }, session);

    const progress = await this.applicationRepository.findProgressByLeadUuid(leadUuid, session);

    if (!progress?.eligibility?.isEligible || progress.eligibility.approvedAmount === null) {
      throw new BadRequestException('No eligible loan offer found for this account.');
    }

    const settings = await this.getLoanOfferSettings(session);
    const reasons = await this.reasonForLoanRepository.findAllActive(session);

    return {
      leadUuid,
      applicationUuid: progress.uuid,
      eligibleLoanAmount: progress.eligibility.approvedAmount,
      minLoanAmount: settings.minLoanAmount,
      maxLoanAmount: settings.maxLoanAmount,
      loanTenure: settings.loanTenure,
      roiPerDay: settings.roiPerDay,
      processingFee: settings.processingFee,
      processingFeeGst: settings.processingFeeGst,
      cibilScore: progress.eligibility.cibilScore,
      reasons
    };
  }

  async saveLoanOffer(params: {
    leadUuid?: string;
    customerUuid: string;
    mobileNumber?: string | null;
    reasonForLoanId: number;
    loanAmount: number;
  }, session?: DatabaseSession): Promise<{ leadUuid: string }> {
    const leadUuid = await this.resolveLeadUuid({
      leadUuid: params.leadUuid,
      customerUuid: params.customerUuid,
      mobileNumber: params.mobileNumber
    }, session);

    const application = await this.ensureDraftForLead({ leadUuid }, session);
    const progress = await this.applicationRepository.findProgressByLeadUuid(leadUuid, session);

    if (!progress?.eligibility?.isEligible || progress.eligibility.approvedAmount === null) {
      throw new BadRequestException('No eligible loan offer found for this account.');
    }

    const reason = await this.reasonForLoanRepository.findActiveById(params.reasonForLoanId, session);

    if (!reason) {
      throw new BadRequestException('Selected purpose of loan is invalid.');
    }

    const settings = await this.getLoanOfferSettings(session);
    const eligibleLoanAmount = progress.eligibility.approvedAmount;

    if (params.loanAmount < settings.minLoanAmount) {
      throw new BadRequestException(`Loan amount must be at least ${settings.minLoanAmount}.`);
    }

    if (params.loanAmount > eligibleLoanAmount) {
      throw new BadRequestException(`Loan amount cannot exceed ${eligibleLoanAmount}.`);
    }

    const breakdown = this.calculateLoanOfferBreakdown(params.loanAmount, settings);

    await this.applicationDetailsRepository.upsertLoanOfferDetails({
      applicationId: application.id,
      reasonForLoanId: params.reasonForLoanId,
      loanAmount: params.loanAmount,
      loanTenure: settings.loanTenure,
      interestRate: settings.roiPerDay,
      interestAmount: breakdown.interestAmount,
      processingFee: settings.processingFee,
      processingFeeAmount: breakdown.processingFeeAmount,
      gstAmount: breakdown.gstAmount,
      loanDisbursementDate: breakdown.loanDisbursementDate,
      loanMaturityDate: breakdown.loanMaturityDate
    }, session);

    const inReviewStatusId = await this.applicationStatusRepository.findActiveIdByName('IN_REVIEW', session);

    if (!inReviewStatusId) {
      throw new ApplicationConfigurationException('IN_REVIEW application status not found — run seeds');
    }

    await this.applicationRepository.updateStatusById(application.id, inReviewStatusId, session);

    return { leadUuid };
  }

  async resolveCustomerFlowStage(params: {
    leadUuid?: string | null;
    leadStatus?: string | null;
  }, session?: DatabaseSession): Promise<CustomerFlowStage> {
    if (!params.leadUuid || !params.leadStatus || params.leadStatus === 'NEW') {
      return 'onboarding';
    }

    if (params.leadStatus === 'EMAIL_VERIFIED') {
      return 'account';
    }

    if (params.leadStatus === 'CONVERTED') {
      return 'my-account';
    }

    if (params.leadStatus !== 'DETAIL_STARTED') {
      return 'my-account';
    }

    const progress = await this.applicationRepository.findProgressByLeadUuid(params.leadUuid, session);

    if (progress?.details?.reasonForLoanId && progress.details.loanAmount !== null) {
      return 'kyc';
    }

    if (progress?.eligibility?.isEligible && progress.eligibility.approvedAmount !== null) {
      return 'loan-offer';
    }

    return 'professional';
  }

  async saveOnboardingDetails(params: {
    leadUuid?: string;
    customerUuid: string;
    mobileNumber?: string | null;
    fullName: string;
    dob: string;
    gender: keyof typeof GENDER_NAME_BY_VALUE;
    occupation: keyof typeof OCCUPATION_NAME_BY_VALUE;
    addressLine1: string;
    addressLine2?: string;
    currentCity: string;
    pincode: string;
    monthlyIncome?: string;
    annualTurnover?: string;
    annualProfit?: string;
    creditConsentAccepted: boolean;
  }, session?: DatabaseSession): Promise<string> {
    const leadUuid = await this.resolveLeadUuid({
      leadUuid: params.leadUuid,
      customerUuid: params.customerUuid,
      mobileNumber: params.mobileNumber
    }, session);

    await this.ensureDraftForLead({ leadUuid }, session);
    const leadId = await this.requireLeadId(leadUuid, session);
    const dateOfBirth = this.parseDob(params.dob);
    const genderId = await this.leadDetailsRepository.findActiveGenderIdByName(
      GENDER_NAME_BY_VALUE[params.gender],
      session
    );
    const cityId = await this.leadDetailsRepository.findActiveCityIdByName(params.currentCity, session);
    const occupationId = await this.leadDetailsRepository.findActiveOccupationIdByName(
      OCCUPATION_NAME_BY_VALUE[params.occupation],
      session
    );

    if (!genderId) {
      throw new BadRequestException('Selected gender is invalid.');
    }

    if (!cityId) {
      throw new BadRequestException('Selected city is invalid.');
    }

    if (!occupationId) {
      throw new BadRequestException('Selected occupation is invalid.');
    }

    await this.leadDetailsRepository.upsertOnboardingDetails({
      leadId,
      fullName: params.fullName.trim(),
      dateOfBirth,
      genderId,
      addressLine1: params.addressLine1.trim(),
      addressLine2: params.addressLine2?.trim() || null,
      cityId,
      pincode: params.pincode,
      occupationId,
      monthlyIncome: params.monthlyIncome ?? null,
      annualTurnover: params.annualTurnover ?? null,
      annualProfit: params.annualProfit ?? null,
      cibilConsentAt: params.creditConsentAccepted ? new Date() : null
    }, session);

    await this.leadService.updateLeadStatusByUuid(leadUuid, 'DETAIL_STARTED', session);

    return leadUuid;
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - dateOfBirth.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())) {
      age -= 1;
    }
    return age;
  }

  private async getLoanOfferSettings(session?: DatabaseSession): Promise<LoanOfferSettings> {
    const values = await this.settingRepository.findActiveValuesByKeys([
      SettingKey.MIN_LOAN_AMOUNT.key,
      SettingKey.MAX_LOAN_AMOUNT.key,
      SettingKey.LOAN_TENURE.key,
      SettingKey.ROI_PER_DAY.key,
      SettingKey.PROCESSING_FEE.key,
      SettingKey.PROCESSING_FEE_GST.key
    ], session);

    const minLoanAmount = this.parsePositiveIntegerSetting(
      values[SettingKey.MIN_LOAN_AMOUNT.key],
      SettingKey.MIN_LOAN_AMOUNT.default,
      SettingKey.MIN_LOAN_AMOUNT.key
    );
    const maxLoanAmount = this.parsePositiveIntegerSetting(
      values[SettingKey.MAX_LOAN_AMOUNT.key],
      SettingKey.MAX_LOAN_AMOUNT.default,
      SettingKey.MAX_LOAN_AMOUNT.key
    );
    const loanTenure = this.parsePositiveIntegerSetting(
      values[SettingKey.LOAN_TENURE.key],
      SettingKey.LOAN_TENURE.default,
      SettingKey.LOAN_TENURE.key
    );
    const roiPerDay = this.parseNonNegativeNumberSetting(
      values[SettingKey.ROI_PER_DAY.key],
      SettingKey.ROI_PER_DAY.default,
      SettingKey.ROI_PER_DAY.key
    );
    const processingFee = this.parseNonNegativeNumberSetting(
      values[SettingKey.PROCESSING_FEE.key],
      SettingKey.PROCESSING_FEE.default,
      SettingKey.PROCESSING_FEE.key
    );
    const processingFeeGst = this.parseNonNegativeNumberSetting(
      values[SettingKey.PROCESSING_FEE_GST.key],
      SettingKey.PROCESSING_FEE_GST.default,
      SettingKey.PROCESSING_FEE_GST.key
    );

    if (minLoanAmount > maxLoanAmount) {
      throw new ApplicationConfigurationException('MIN_LOAN_AMOUNT cannot be greater than MAX_LOAN_AMOUNT.');
    }

    return {
      minLoanAmount,
      maxLoanAmount,
      loanTenure,
      roiPerDay,
      processingFee,
      processingFeeGst
    };
  }

  private generateEligibleLoanAmount(settings: LoanOfferSettings): number {
    return randomInt(settings.minLoanAmount, settings.maxLoanAmount);
  }

  private calculateLoanOfferBreakdown(loanAmount: number, settings: LoanOfferSettings) {
    const interestAmount = this.roundCurrency(
      loanAmount * (settings.roiPerDay / 100) * settings.loanTenure
    );
    const processingFeeAmount = this.roundCurrency(
      loanAmount * (settings.processingFee / 100)
    );
    const gstAmount = this.roundCurrency(
      processingFeeAmount * (settings.processingFeeGst / 100)
    );
    const loanDisbursementDate = this.startOfUtcDay(new Date());
    const loanMaturityDate = new Date(loanDisbursementDate);
    loanMaturityDate.setUTCDate(loanMaturityDate.getUTCDate() + settings.loanTenure);

    return {
      interestAmount,
      processingFeeAmount,
      gstAmount,
      loanDisbursementDate,
      loanMaturityDate
    };
  }

  private roundCurrency(value: number): number {
    return Number(value.toFixed(2));
  }

  private startOfUtcDay(value: Date): Date {
    return new Date(Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate()
    ));
  }

  private parsePositiveIntegerSetting(value: string | undefined, fallback: string, key: string): number {
    const resolvedValue = Number.parseInt((value ?? fallback).trim(), 10);

    if (!Number.isInteger(resolvedValue) || resolvedValue <= 0) {
      throw new ApplicationConfigurationException(`${key} setting is invalid.`);
    }

    return resolvedValue;
  }

  private parseNonNegativeNumberSetting(value: string | undefined, fallback: string, key: string): number {
    const resolvedValue = Number.parseFloat((value ?? fallback).trim());

    if (!Number.isFinite(resolvedValue) || resolvedValue < 0) {
      throw new ApplicationConfigurationException(`${key} setting is invalid.`);
    }

    return resolvedValue;
  }

  private async requireLeadId(leadUuid: string, session?: DatabaseSession): Promise<bigint> {
    const leadId = await this.leadService.findIdByLeadUuid(leadUuid, session);

    if (!leadId) {
      throw new BadRequestException('Lead reference not found for this account. Please restart the application flow.');
    }

    return leadId;
  }

  private async resolveLeadUuid(params: {
    leadUuid?: string;
    customerUuid: string;
    mobileNumber?: string | null;
  }, session?: DatabaseSession): Promise<string> {
    const leadUuid = await this.leadService.resolveLeadUuidForCustomer({
      leadUuid: params.leadUuid,
      customerUuid: params.customerUuid,
      mobileNumber: params.mobileNumber
    }, session);

    if (!leadUuid) {
      throw new BadRequestException('Lead reference not found for this account. Please restart the application flow.');
    }

    return leadUuid;
  }

  private parseDob(dob: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      throw new BadRequestException('Date of birth must be in YYYY-MM-DD format.');
    }

    const [year, month, day] = dob.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    if (
      parsedDate.getUTCFullYear() !== year
      || parsedDate.getUTCMonth() !== month - 1
      || parsedDate.getUTCDate() !== day
    ) {
      throw new BadRequestException('Date of birth is invalid.');
    }

    const today = new Date();
    let age = today.getUTCFullYear() - parsedDate.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - parsedDate.getUTCMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < parsedDate.getUTCDate())) {
      age -= 1;
    }

    if (age < 18) {
      throw new BadRequestException('Customer must be at least 18 years old.');
    }

    return parsedDate;
  }
}

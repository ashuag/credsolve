"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const gender_constants_1 = require("../../../common/constants/gender.constants");
const occupation_constants_1 = require("../../../common/constants/occupation.constants");
const lead_details_repository_1 = require("../../lead/repositories/lead-details.repository");
const lead_service_1 = require("../../lead/services/lead.service");
const application_configuration_exception_1 = require("../exceptions/application-configuration.exception");
const application_details_repository_1 = require("../repositories/application-details.repository");
const application_repository_1 = require("../repositories/application.repository");
const application_status_repository_1 = require("../repositories/application-status.repository");
const pan_verification_service_1 = require("./pan-verification.service");
const eligibility_service_1 = require("./eligibility.service");
const application_eligibility_repository_1 = require("../repositories/application-eligibility.repository");
const GENDER_NAME_BY_VALUE = {
    male: gender_constants_1.GENDER.MALE,
    female: gender_constants_1.GENDER.FEMALE,
    others: gender_constants_1.GENDER.OTHERS
};
const OCCUPATION_NAME_BY_VALUE = {
    salaried: occupation_constants_1.OCCUPATION.SALARIED,
    self_employed_professional: occupation_constants_1.OCCUPATION.SELF_EMPLOYED_PROFESSIONAL,
    self_employed_business: occupation_constants_1.OCCUPATION.SELF_EMPLOYED_BUSINESS,
    student: occupation_constants_1.OCCUPATION.STUDENT,
    homemaker: occupation_constants_1.OCCUPATION.HOMEMAKER,
    retired: occupation_constants_1.OCCUPATION.RETIRED
};
let ApplicationService = class ApplicationService {
    applicationRepository;
    applicationStatusRepository;
    applicationDetailsRepository;
    applicationEligibilityRepository;
    leadDetailsRepository;
    leadService;
    panVerificationService;
    eligibilityService;
    constructor(applicationRepository, applicationStatusRepository, applicationDetailsRepository, applicationEligibilityRepository, leadDetailsRepository, leadService, panVerificationService, eligibilityService) {
        this.applicationRepository = applicationRepository;
        this.applicationStatusRepository = applicationStatusRepository;
        this.applicationDetailsRepository = applicationDetailsRepository;
        this.applicationEligibilityRepository = applicationEligibilityRepository;
        this.leadDetailsRepository = leadDetailsRepository;
        this.leadService = leadService;
        this.panVerificationService = panVerificationService;
        this.eligibilityService = eligibilityService;
    }
    async ensureDraftForLead(params, session) {
        const existing = await this.applicationRepository.findByLeadUuid(params.leadUuid, session);
        if (existing) {
            return existing;
        }
        const statusId = await this.applicationStatusRepository.findActiveIdByName('DRAFT', session);
        if (!statusId) {
            throw new application_configuration_exception_1.ApplicationConfigurationException('DRAFT application status not found — run seeds');
        }
        const uuid = (0, node_crypto_1.randomUUID)();
        const customerId = await this.leadService.findCustomerIdByLeadUuid(params.leadUuid, session);
        if (!customerId) {
            throw new application_configuration_exception_1.ApplicationConfigurationException('Application creation failed — lead not found');
        }
        await this.applicationRepository.create({
            uuid,
            customerId,
            leadUuid: params.leadUuid,
            statusId
        }, session);
        const created = await this.applicationRepository.findByLeadUuid(params.leadUuid, session);
        if (!created) {
            throw new application_configuration_exception_1.ApplicationConfigurationException('Application creation failed — lead not found');
        }
        return created;
    }
    async saveDetails(params, session) {
        const leadUuid = await this.resolveLeadUuid({
            leadUuid: params.leadUuid,
            customerUuid: params.customerUuid,
            mobileNumber: params.mobileNumber
        }, session);
        const application = await this.ensureDraftForLead({ leadUuid }, session);
        const leadId = await this.requireLeadId(leadUuid, session);
        const genderId = await this.leadDetailsRepository.findActiveGenderIdByName(GENDER_NAME_BY_VALUE[params.gender], session);
        if (!genderId) {
            throw new common_1.BadRequestException('Selected gender is invalid.');
        }
        await this.applicationDetailsRepository.upsert({
            applicationId: application.id,
            panNumber: params.panNumber
        }, session);
        await this.leadDetailsRepository.upsertPersonalDetails({
            leadId,
            fullName: params.fullName,
            dateOfBirth: params.dateOfBirth,
            genderId
        }, session);
        // Advance lead to DETAIL_STARTED regardless of PAN result
        await this.leadService.updateLeadStatusByUuid(leadUuid, 'DETAIL_STARTED', session);
        // Run PAN verification; on success advance application to SUBMITTED
        const panResult = await this.panVerificationService.verify(params.panNumber, params.fullName);
        if (panResult.status === 'verified') {
            const submittedStatusId = await this.applicationStatusRepository.findActiveIdByName('SUBMITTED', session);
            if (!submittedStatusId) {
                throw new application_configuration_exception_1.ApplicationConfigurationException('SUBMITTED application status not found — run seeds');
            }
            await this.applicationRepository.updateStatusById(application.id, submittedStatusId, session);
        }
        return { leadUuid, panResult };
    }
    async saveProfessionalDetails(params, session) {
        const leadUuid = await this.resolveLeadUuid({
            leadUuid: params.leadUuid,
            customerUuid: params.customerUuid,
            mobileNumber: params.mobileNumber
        }, session);
        const application = await this.ensureDraftForLead({ leadUuid }, session);
        const leadId = await this.requireLeadId(leadUuid, session);
        const cityId = await this.leadDetailsRepository.findActiveCityIdByName(params.currentCity, session);
        if (!cityId)
            throw new common_1.BadRequestException('Selected city is invalid.');
        const occupationId = await this.leadDetailsRepository.findActiveOccupationIdByName(OCCUPATION_NAME_BY_VALUE[params.occupation], session);
        if (!occupationId)
            throw new common_1.BadRequestException('Selected occupation is invalid.');
        await this.leadDetailsRepository.upsertProfessionalDetails({
            leadId,
            cityId,
            pincode: params.pincode,
            occupationId,
            monthlyIncome: params.monthlyIncome ?? null,
            annualTurnover: params.annualTurnover ?? null,
            annualProfit: params.annualProfit ?? null
        }, session);
        // Fetch the personal details we need for eligibility (DOB → age, PAN number)
        const personalDetails = await this.leadDetailsRepository.findPersonalDetailsByLeadId(leadId, session);
        const applicationDetails = await this.applicationDetailsRepository.findByApplicationId(application.id, session);
        const ageAtApplication = personalDetails?.dateOfBirth
            ? this.calculateAge(personalDetails.dateOfBirth)
            : 0;
        // Run NSDL bureau + eligibility check
        const eligibility = await this.eligibilityService.check({
            panNumber: applicationDetails?.panNumber ?? '',
            fullName: personalDetails?.fullName ?? '',
            ageAtApplication,
            isExistingCustomer: false, // TODO: derive from customer history
        });
        // Persist eligibility result
        await this.applicationEligibilityRepository.upsert({
            applicationId: application.id,
            isEligible: eligibility.isEligible,
            approvedAmount: eligibility.approvedAmount,
            cibilScore: eligibility.cibilScore,
            ineligibleReason: eligibility.ineligibleReason,
        }, session);
        // Advance application status and lead status
        const targetAppStatus = eligibility.isEligible ? 'APPROVED' : 'REJECTED';
        const appStatusId = await this.applicationStatusRepository.findActiveIdByName(targetAppStatus, session);
        if (!appStatusId)
            throw new common_1.BadRequestException(`${targetAppStatus} application status not configured — run seeds`);
        await this.applicationRepository.updateStatusById(application.id, appStatusId, session);
        await this.leadService.updateLeadStatusByUuid(leadUuid, 'CONVERTED', session);
        return { leadUuid, eligibility };
    }
    calculateAge(dateOfBirth) {
        const today = new Date();
        let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
        const monthDiff = today.getUTCMonth() - dateOfBirth.getUTCMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())) {
            age -= 1;
        }
        return age;
    }
    async saveOnboardingDetails(params, session) {
        const leadUuid = await this.resolveLeadUuid({
            leadUuid: params.leadUuid,
            customerUuid: params.customerUuid,
            mobileNumber: params.mobileNumber
        }, session);
        await this.ensureDraftForLead({ leadUuid }, session);
        const leadId = await this.requireLeadId(leadUuid, session);
        const dateOfBirth = this.parseDob(params.dob);
        const genderId = await this.leadDetailsRepository.findActiveGenderIdByName(GENDER_NAME_BY_VALUE[params.gender], session);
        const cityId = await this.leadDetailsRepository.findActiveCityIdByName(params.currentCity, session);
        const occupationId = await this.leadDetailsRepository.findActiveOccupationIdByName(OCCUPATION_NAME_BY_VALUE[params.occupation], session);
        if (!genderId) {
            throw new common_1.BadRequestException('Selected gender is invalid.');
        }
        if (!cityId) {
            throw new common_1.BadRequestException('Selected city is invalid.');
        }
        if (!occupationId) {
            throw new common_1.BadRequestException('Selected occupation is invalid.');
        }
        await this.leadDetailsRepository.upsertOnboardingDetails({
            leadId,
            fullName: params.fullName.trim(),
            dateOfBirth,
            genderId,
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
    async requireLeadId(leadUuid, session) {
        const leadId = await this.leadService.findIdByLeadUuid(leadUuid, session);
        if (!leadId) {
            throw new common_1.BadRequestException('Lead reference not found for this account. Please restart the application flow.');
        }
        return leadId;
    }
    async resolveLeadUuid(params, session) {
        const leadUuid = await this.leadService.resolveLeadUuidForCustomer({
            leadUuid: params.leadUuid,
            customerUuid: params.customerUuid,
            mobileNumber: params.mobileNumber
        }, session);
        if (!leadUuid) {
            throw new common_1.BadRequestException('Lead reference not found for this account. Please restart the application flow.');
        }
        return leadUuid;
    }
    parseDob(dob) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
            throw new common_1.BadRequestException('Date of birth must be in YYYY-MM-DD format.');
        }
        const [year, month, day] = dob.split('-').map(Number);
        const parsedDate = new Date(Date.UTC(year, month - 1, day));
        if (parsedDate.getUTCFullYear() !== year
            || parsedDate.getUTCMonth() !== month - 1
            || parsedDate.getUTCDate() !== day) {
            throw new common_1.BadRequestException('Date of birth is invalid.');
        }
        const today = new Date();
        let age = today.getUTCFullYear() - parsedDate.getUTCFullYear();
        const monthDiff = today.getUTCMonth() - parsedDate.getUTCMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < parsedDate.getUTCDate())) {
            age -= 1;
        }
        if (age < 18) {
            throw new common_1.BadRequestException('Customer must be at least 18 years old.');
        }
        return parsedDate;
    }
};
exports.ApplicationService = ApplicationService;
exports.ApplicationService = ApplicationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [application_repository_1.ApplicationRepository,
        application_status_repository_1.ApplicationStatusRepository,
        application_details_repository_1.ApplicationDetailsRepository,
        application_eligibility_repository_1.ApplicationEligibilityRepository,
        lead_details_repository_1.LeadDetailsRepository,
        lead_service_1.LeadService,
        pan_verification_service_1.PanVerificationService,
        eligibility_service_1.EligibilityService])
], ApplicationService);

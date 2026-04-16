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
exports.LeadService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const lead_configuration_exception_1 = require("../exceptions/lead-configuration.exception");
const lead_repository_1 = require("../repositories/lead.repository");
const lead_status_repository_1 = require("../repositories/lead-status.repository");
let LeadService = class LeadService {
    leadRepository;
    leadStatusRepository;
    constructor(leadRepository, leadStatusRepository) {
        this.leadRepository = leadRepository;
        this.leadStatusRepository = leadStatusRepository;
    }
    async ensureForCustomer(customerId, utmParams, session) {
        const existing = await this.leadRepository.findLatestStateByCustomerId(customerId, session);
        if (existing) {
            return existing;
        }
        const leadStatusId = await this.leadStatusRepository.findActiveIdByName('NEW', session);
        if (!leadStatusId) {
            throw new lead_configuration_exception_1.LeadConfigurationException('NEW lead status not found — run seeds');
        }
        const uuid = (0, node_crypto_1.randomUUID)();
        await this.leadRepository.create({
            uuid,
            customerId,
            leadStatusId,
            utmParams
        }, session);
        return { uuid, email: null, leadStatus: 'NEW' };
    }
    async findLatestStateForCustomer(params, session) {
        const latestByCustomerUuid = await this.leadRepository.findLatestStateByCustomerUuid(params.customerUuid, session);
        if (latestByCustomerUuid) {
            return latestByCustomerUuid;
        }
        if (!params.mobileNumber) {
            return undefined;
        }
        return this.leadRepository.findLatestStateByMobileNumber(params.mobileNumber, session);
    }
    async updateLeadStatusByUuid(leadUuid, statusName, session) {
        const statusId = await this.leadStatusRepository.findActiveIdByName(statusName, session);
        if (!statusId) {
            throw new lead_configuration_exception_1.LeadConfigurationException(`${statusName} lead status not found — run seeds`);
        }
        await this.leadRepository.updateStatusByUuid(leadUuid, statusId, session);
    }
    async findCustomerIdByLeadUuid(leadUuid, session) {
        return this.leadRepository.findCustomerIdByLeadUuid(leadUuid, session);
    }
    async findIdByLeadUuid(leadUuid, session) {
        return this.leadRepository.findIdByLeadUuid(leadUuid, session);
    }
    async findLatestUuidByMobileNumber(mobileNumber, session) {
        return this.leadRepository.findLatestUuidByMobileNumber(mobileNumber, session);
    }
    async resolveLeadUuidForCustomer(params, session) {
        if (params.leadUuid) {
            return this.leadRepository.findOwnedUuid(params.leadUuid, params.customerUuid, session);
        }
        if (!params.mobileNumber) {
            return undefined;
        }
        return this.leadRepository.findLatestUuidByMobileNumber(params.mobileNumber, session);
    }
    async syncEmailForCustomer(params, session) {
        let leadStatusId;
        let emailVerificationType;
        if (params.emailVerified) {
            const statusId = await this.leadStatusRepository.findActiveIdByName('EMAIL_VERIFIED', session);
            if (!statusId) {
                throw new lead_configuration_exception_1.LeadConfigurationException('EMAIL_VERIFIED lead status not found — run seeds');
            }
            leadStatusId = statusId;
            emailVerificationType = params.verificationType === 'google' ? 'GOOGLE' : 'OTP';
        }
        const resolvedLeadUuid = await this.resolveLeadUuidForCustomer({
            leadUuid: params.leadUuid,
            customerUuid: params.customerUuid,
            mobileNumber: params.mobileNumber
        }, session);
        if (!resolvedLeadUuid) {
            if (params.leadUuid) {
                throw new common_1.BadRequestException('Lead reference not found for this account.');
            }
            return undefined;
        }
        await this.leadRepository.updateEmailByUuid({
            leadUuid: resolvedLeadUuid,
            email: params.email,
            leadStatusId,
            emailVerificationType
        }, session);
        if (params.emailVerified && params.verificationType === 'google') {
            await this.leadRepository.markLatestPendingEmailOtpVerifiedByEmail(params.email, new Date(), session);
        }
        return resolvedLeadUuid;
    }
};
exports.LeadService = LeadService;
exports.LeadService = LeadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [lead_repository_1.LeadRepository,
        lead_status_repository_1.LeadStatusRepository])
], LeadService);

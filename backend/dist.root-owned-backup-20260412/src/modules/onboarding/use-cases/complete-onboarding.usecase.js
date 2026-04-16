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
exports.CompleteOnboardingUseCase = void 0;
const common_1 = require("@nestjs/common");
const customer_service_1 = require("../../customer/services/customer.service");
const lead_configuration_exception_1 = require("../../lead/exceptions/lead-configuration.exception");
const lead_service_1 = require("../../lead/services/lead.service");
const onboarding_configuration_exception_1 = require("../exceptions/onboarding-configuration.exception");
let CompleteOnboardingUseCase = class CompleteOnboardingUseCase {
    customerService;
    leadService;
    constructor(customerService, leadService) {
        this.customerService = customerService;
        this.leadService = leadService;
    }
    async execute(params, session) {
        const customer = await this.customerService.ensureByMobileNumber(params.mobileNumber, session);
        if (!customer) {
            return undefined;
        }
        try {
            const lead = await this.leadService.ensureForCustomer(BigInt(customer.id), params.utmParams, session);
            return {
                ...customer,
                ...(lead ? { leadUuid: lead.uuid, leadEmail: lead.email, leadStatus: lead.leadStatus } : {})
            };
        }
        catch (error) {
            if (error instanceof lead_configuration_exception_1.LeadConfigurationException) {
                throw new onboarding_configuration_exception_1.OnboardingConfigurationException(error.resource);
            }
            throw error;
        }
    }
};
exports.CompleteOnboardingUseCase = CompleteOnboardingUseCase;
exports.CompleteOnboardingUseCase = CompleteOnboardingUseCase = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [customer_service_1.CustomerService,
        lead_service_1.LeadService])
], CompleteOnboardingUseCase);

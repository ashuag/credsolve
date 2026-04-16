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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerLeadController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const application_service_1 = require("../../application/services/application.service");
const current_customer_decorator_1 = require("../../auth/decorators/current-customer.decorator");
const customer_jwt_guard_1 = require("../../auth/guards/customer-jwt.guard");
const save_lead_details_dto_1 = require("../dto/inputDto/save-lead-details.dto");
const sync_lead_email_dto_1 = require("../dto/inputDto/sync-lead-email.dto");
const lead_service_1 = require("../services/lead.service");
let CustomerLeadController = class CustomerLeadController {
    leadService;
    applicationService;
    constructor(leadService, applicationService) {
        this.leadService = leadService;
        this.applicationService = applicationService;
    }
    async syncLeadEmail(customer, dto) {
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
    async getLeadStatus(customer) {
        const lead = await this.leadService.findLatestStateForCustomer({
            customerUuid: customer.sub,
            mobileNumber: customer.mobileNumber
        });
        return {
            leadId: lead?.uuid ?? null,
            leadStatus: lead?.leadStatus ?? null
        };
    }
    async saveLeadDetails(customer, dto) {
        const leadUuid = await this.applicationService.saveOnboardingDetails({
            customerUuid: customer.sub,
            mobileNumber: customer.mobileNumber,
            leadUuid: dto.leadUuid,
            fullName: dto.fullName,
            dob: dto.dob,
            gender: dto.gender,
            occupation: dto.occupation,
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
};
exports.CustomerLeadController = CustomerLeadController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Sync the authenticated customer email on their current lead' }),
    (0, common_1.Post)('email'),
    __param(0, (0, current_customer_decorator_1.CurrentCustomer)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sync_lead_email_dto_1.SyncLeadEmailDto]),
    __metadata("design:returntype", Promise)
], CustomerLeadController.prototype, "syncLeadEmail", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get the latest lead status for the authenticated customer' }),
    (0, common_1.Get)('status'),
    __param(0, (0, current_customer_decorator_1.CurrentCustomer)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CustomerLeadController.prototype, "getLeadStatus", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Save onboarding customer details for the authenticated customer lead' }),
    (0, common_1.Post)('details'),
    __param(0, (0, current_customer_decorator_1.CurrentCustomer)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, save_lead_details_dto_1.SaveLeadDetailsDto]),
    __metadata("design:returntype", Promise)
], CustomerLeadController.prototype, "saveLeadDetails", null);
exports.CustomerLeadController = CustomerLeadController = __decorate([
    (0, swagger_1.ApiTags)('Leads'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(customer_jwt_guard_1.CustomerJwtGuard),
    (0, common_1.Controller)('leads'),
    __metadata("design:paramtypes", [lead_service_1.LeadService,
        application_service_1.ApplicationService])
], CustomerLeadController);

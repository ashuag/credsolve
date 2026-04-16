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
exports.CustomerApplicationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_customer_decorator_1 = require("../../auth/decorators/current-customer.decorator");
const customer_jwt_guard_1 = require("../../auth/guards/customer-jwt.guard");
const save_application_details_dto_1 = require("../dto/inputDto/save-application-details.dto");
const save_professional_details_dto_1 = require("../dto/inputDto/save-professional-details.dto");
const application_service_1 = require("../services/application.service");
let CustomerApplicationController = class CustomerApplicationController {
    applicationService;
    constructor(applicationService) {
        this.applicationService = applicationService;
    }
    async saveApplicationDetails(customer, dto) {
        const { leadUuid, panResult } = await this.applicationService.saveDetails({
            leadUuid: dto.leadUuid,
            customerUuid: customer.sub,
            mobileNumber: customer.mobileNumber,
            fullName: dto.fullName,
            dateOfBirth: dto.dateOfBirth,
            gender: dto.gender,
            panNumber: dto.panNumber
        });
        return { success: true, leadUuid, panResult };
    }
    async saveProfessionalDetails(customer, dto) {
        const { leadUuid, eligibility } = await this.applicationService.saveProfessionalDetails({
            leadUuid: dto.leadUuid,
            customerUuid: customer.sub,
            mobileNumber: customer.mobileNumber,
            currentCity: dto.currentCity,
            pincode: dto.pincode,
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
};
exports.CustomerApplicationController = CustomerApplicationController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Save basic KYC details, advance lead to DETAIL_STARTED, verify PAN' }),
    (0, common_1.Post)('details'),
    __param(0, (0, current_customer_decorator_1.CurrentCustomer)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, save_application_details_dto_1.SaveApplicationDetailsDto]),
    __metadata("design:returntype", Promise)
], CustomerApplicationController.prototype, "saveApplicationDetails", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Save professional details, run NSDL bureau + eligibility check' }),
    (0, common_1.Post)('professional-details'),
    __param(0, (0, current_customer_decorator_1.CurrentCustomer)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, save_professional_details_dto_1.SaveProfessionalDetailsDto]),
    __metadata("design:returntype", Promise)
], CustomerApplicationController.prototype, "saveProfessionalDetails", null);
exports.CustomerApplicationController = CustomerApplicationController = __decorate([
    (0, swagger_1.ApiTags)('Applications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(customer_jwt_guard_1.CustomerJwtGuard),
    (0, common_1.Controller)('applications'),
    __metadata("design:paramtypes", [application_service_1.ApplicationService])
], CustomerApplicationController);

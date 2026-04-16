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
exports.LosMastersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const los_jwt_guard_1 = require("../guards/los-jwt.guard");
const create_city_dto_1 = require("./dto/create-city.dto");
const create_lead_source_dto_1 = require("./dto/create-lead-source.dto");
const create_named_master_dto_1 = require("./dto/create-named-master.dto");
const create_state_dto_1 = require("./dto/create-state.dto");
const update_city_dto_1 = require("./dto/update-city.dto");
const update_lead_source_dto_1 = require("./dto/update-lead-source.dto");
const update_named_master_dto_1 = require("./dto/update-named-master.dto");
const update_state_dto_1 = require("./dto/update-state.dto");
const update_status_display_name_dto_1 = require("./dto/update-status-display-name.dto");
const los_masters_service_1 = require("./los-masters.service");
let LosMastersController = class LosMastersController {
    losMastersService;
    constructor(losMastersService) {
        this.losMastersService = losMastersService;
    }
    getMasters() {
        return this.losMastersService.getMasters();
    }
    updateLeadStatus(id, dto) {
        return this.losMastersService.updateLeadStatus(id, dto);
    }
    updateApplicationStatus(id, dto) {
        return this.losMastersService.updateApplicationStatus(id, dto);
    }
    createLeadSource(dto) {
        return this.losMastersService.createLeadSource(dto);
    }
    updateLeadSource(id, dto) {
        return this.losMastersService.updateLeadSource(id, dto);
    }
    createState(dto) {
        return this.losMastersService.createState(dto);
    }
    updateState(id, dto) {
        return this.losMastersService.updateState(id, dto);
    }
    createCity(dto) {
        return this.losMastersService.createCity(dto);
    }
    updateCity(id, dto) {
        return this.losMastersService.updateCity(id, dto);
    }
    createOccupation(dto) {
        return this.losMastersService.createOccupation(dto);
    }
    updateOccupation(id, dto) {
        return this.losMastersService.updateOccupation(id, dto);
    }
    createReasonForLoan(dto) {
        return this.losMastersService.createReasonForLoan(dto);
    }
    updateReasonForLoan(id, dto) {
        return this.losMastersService.updateReasonForLoan(id, dto);
    }
    createGender(dto) {
        return this.losMastersService.createGender(dto);
    }
    updateGender(id, dto) {
        return this.losMastersService.updateGender(id, dto);
    }
    // ── Eligibility Criteria ────────────────────────────────────────────────────
    getEligibilityCriteria() {
        return this.losMastersService.getEligibilityCriteria();
    }
    updateEligibilityCriterion(id, dto) {
        return this.losMastersService.updateEligibilityCriterion(id, dto);
    }
    // ── Credit Limit Tiers ──────────────────────────────────────────────────────
    getCreditLimitTiers() {
        return this.losMastersService.getCreditLimitTiers();
    }
    updateCreditLimitTier(id, dto) {
        return this.losMastersService.updateCreditLimitTier(id, dto);
    }
};
exports.LosMastersController = LosMastersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List LOS master data for statuses, sources, locations, occupations, reasons for loan, and genders' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "getMasters", null);
__decorate([
    (0, common_1.Patch)('lead-statuses/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update lead status display label or active state' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_status_display_name_dto_1.UpdateStatusDisplayNameDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "updateLeadStatus", null);
__decorate([
    (0, common_1.Patch)('application-statuses/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update application status display label or active state' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_status_display_name_dto_1.UpdateStatusDisplayNameDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "updateApplicationStatus", null);
__decorate([
    (0, common_1.Post)('lead-sources'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a lead source' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_lead_source_dto_1.CreateLeadSourceDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "createLeadSource", null);
__decorate([
    (0, common_1.Patch)('lead-sources/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update or soft delete a lead source' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_lead_source_dto_1.UpdateLeadSourceDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "updateLeadSource", null);
__decorate([
    (0, common_1.Post)('states'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a state' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_state_dto_1.CreateStateDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "createState", null);
__decorate([
    (0, common_1.Patch)('states/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update or soft delete a state' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_state_dto_1.UpdateStateDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "updateState", null);
__decorate([
    (0, common_1.Post)('cities'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a city' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_city_dto_1.CreateCityDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "createCity", null);
__decorate([
    (0, common_1.Patch)('cities/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update or soft delete a city' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_city_dto_1.UpdateCityDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "updateCity", null);
__decorate([
    (0, common_1.Post)('occupations'),
    (0, swagger_1.ApiOperation)({ summary: 'Create an occupation' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_named_master_dto_1.CreateNamedMasterDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "createOccupation", null);
__decorate([
    (0, common_1.Patch)('occupations/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update or soft delete an occupation' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_named_master_dto_1.UpdateNamedMasterDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "updateOccupation", null);
__decorate([
    (0, common_1.Post)('reasons-for-loan'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a reason for loan' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_named_master_dto_1.CreateNamedMasterDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "createReasonForLoan", null);
__decorate([
    (0, common_1.Patch)('reasons-for-loan/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update or soft delete a reason for loan' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_named_master_dto_1.UpdateNamedMasterDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "updateReasonForLoan", null);
__decorate([
    (0, common_1.Post)('genders'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a gender' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_named_master_dto_1.CreateNamedMasterDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "createGender", null);
__decorate([
    (0, common_1.Patch)('genders/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update or soft delete a gender' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_named_master_dto_1.UpdateNamedMasterDto]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "updateGender", null);
__decorate([
    (0, common_1.Get)('eligibility-criteria'),
    (0, swagger_1.ApiOperation)({ summary: 'List all eligibility criteria' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "getEligibilityCriteria", null);
__decorate([
    (0, common_1.Patch)('eligibility-criteria/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update an eligibility criterion value or active state' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "updateEligibilityCriterion", null);
__decorate([
    (0, common_1.Get)('credit-limit-tiers'),
    (0, swagger_1.ApiOperation)({ summary: 'List all credit limit tiers (Eligibility Basis table)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "getCreditLimitTiers", null);
__decorate([
    (0, common_1.Patch)('credit-limit-tiers/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a credit limit tier' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], LosMastersController.prototype, "updateCreditLimitTier", null);
exports.LosMastersController = LosMastersController = __decorate([
    (0, swagger_1.ApiTags)('LOS Masters'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(los_jwt_guard_1.LosJwtGuard),
    (0, common_1.Controller)('los/masters'),
    __metadata("design:paramtypes", [los_masters_service_1.LosMastersService])
], LosMastersController);

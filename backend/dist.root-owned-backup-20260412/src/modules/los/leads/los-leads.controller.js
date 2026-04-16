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
exports.LosLeadsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const los_jwt_guard_1 = require("../guards/los-jwt.guard");
const los_leads_service_1 = require("./los-leads.service");
let LosLeadsController = class LosLeadsController {
    losLeadsService;
    constructor(losLeadsService) {
        this.losLeadsService = losLeadsService;
    }
    getNewLeads() {
        return this.losLeadsService.getNewLeads();
    }
};
exports.LosLeadsController = LosLeadsController;
__decorate([
    (0, common_1.Get)('new'),
    (0, swagger_1.ApiOperation)({ summary: 'List active LOS leads ordered by newest first' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LosLeadsController.prototype, "getNewLeads", null);
exports.LosLeadsController = LosLeadsController = __decorate([
    (0, swagger_1.ApiTags)('LOS Leads'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(los_jwt_guard_1.LosJwtGuard),
    (0, common_1.Controller)('los/leads'),
    __metadata("design:paramtypes", [los_leads_service_1.LosLeadsService])
], LosLeadsController);

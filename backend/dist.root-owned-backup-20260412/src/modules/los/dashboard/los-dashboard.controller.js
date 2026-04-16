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
exports.LosDashboardController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const los_dashboard_service_1 = require("./los-dashboard.service");
let LosDashboardController = class LosDashboardController {
    losDashboardService;
    constructor(losDashboardService) {
        this.losDashboardService = losDashboardService;
    }
    getCrmDashboard() {
        return this.losDashboardService.getCrmDashboard();
    }
};
exports.LosDashboardController = LosDashboardController;
__decorate([
    (0, common_1.Get)('crm'),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch LOS CRM dashboard metrics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LosDashboardController.prototype, "getCrmDashboard", null);
exports.LosDashboardController = LosDashboardController = __decorate([
    (0, swagger_1.ApiTags)('LOS Dashboard'),
    (0, common_1.Controller)('los/dashboard'),
    __metadata("design:paramtypes", [los_dashboard_service_1.LosDashboardService])
], LosDashboardController);

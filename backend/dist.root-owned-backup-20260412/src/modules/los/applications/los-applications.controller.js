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
exports.LosApplicationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const los_jwt_guard_1 = require("../guards/los-jwt.guard");
const los_applications_service_1 = require("./los-applications.service");
let LosApplicationsController = class LosApplicationsController {
    losApplicationsService;
    constructor(losApplicationsService) {
        this.losApplicationsService = losApplicationsService;
    }
    getApplications() {
        return this.losApplicationsService.getApplications();
    }
};
exports.LosApplicationsController = LosApplicationsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List LOS applications ordered by newest first' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LosApplicationsController.prototype, "getApplications", null);
exports.LosApplicationsController = LosApplicationsController = __decorate([
    (0, swagger_1.ApiTags)('LOS Applications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(los_jwt_guard_1.LosJwtGuard),
    (0, common_1.Controller)('los/applications'),
    __metadata("design:paramtypes", [los_applications_service_1.LosApplicationsService])
], LosApplicationsController);

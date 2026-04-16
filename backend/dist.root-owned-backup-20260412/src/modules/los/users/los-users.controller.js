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
exports.LosUsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const los_jwt_guard_1 = require("../guards/los-jwt.guard");
const create_user_dto_1 = require("./dto/create-user.dto");
const update_user_dto_1 = require("./dto/update-user.dto");
const los_users_service_1 = require("./los-users.service");
let LosUsersController = class LosUsersController {
    losUsersService;
    constructor(losUsersService) {
        this.losUsersService = losUsersService;
    }
    findAll() {
        return this.losUsersService.findAll();
    }
    create(dto) {
        return this.losUsersService.create(dto);
    }
    update(id, dto) {
        return this.losUsersService.update(id, dto);
    }
    toggleStatus(id) {
        return this.losUsersService.toggleStatus(id);
    }
    resendInvitation(id) {
        return this.losUsersService.resendInvitation(id);
    }
};
exports.LosUsersController = LosUsersController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all LOS agents' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LosUsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new LOS user' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", void 0)
], LosUsersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a LOS user (name, email, role)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", void 0)
], LosUsersController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, swagger_1.ApiOperation)({ summary: 'Toggle user active / inactive' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LosUsersController.prototype, "toggleStatus", null);
__decorate([
    (0, common_1.Post)(':id/resend-invitation'),
    (0, swagger_1.ApiOperation)({ summary: 'Resend the LOS registration email for a pending user' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LosUsersController.prototype, "resendInvitation", null);
exports.LosUsersController = LosUsersController = __decorate([
    (0, swagger_1.ApiTags)('LOS Users'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(los_jwt_guard_1.LosJwtGuard),
    (0, common_1.Controller)('los/users'),
    __metadata("design:paramtypes", [los_users_service_1.LosUsersService])
], LosUsersController);

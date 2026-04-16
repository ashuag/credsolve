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
exports.LosAuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const los_auth_service_1 = require("./los-auth.service");
const login_dto_1 = require("./dto/login.dto");
const accept_invitation_dto_1 = require("./dto/accept-invitation.dto");
let LosAuthController = class LosAuthController {
    losAuthService;
    constructor(losAuthService) {
        this.losAuthService = losAuthService;
    }
    async login(dto) {
        return this.losAuthService.login(dto);
    }
    getInvitation(token) {
        return this.losAuthService.getInvitation(token);
    }
    acceptInvitation(token, dto) {
        return this.losAuthService.acceptInvitation(token, dto);
    }
};
exports.LosAuthController = LosAuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Login for LOS/CRM staff' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Login successful' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LosLoginDto]),
    __metadata("design:returntype", Promise)
], LosAuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('invitations/:token'),
    (0, swagger_1.ApiOperation)({ summary: 'Validate a LOS invitation token' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Invitation token is valid' }),
    (0, swagger_1.ApiResponse)({ status: 410, description: 'Invitation link has expired' }),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LosAuthController.prototype, "getInvitation", null);
__decorate([
    (0, common_1.Post)('invitations/:token/accept'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Set the initial password for a LOS invitation' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password set successfully' }),
    (0, swagger_1.ApiResponse)({ status: 410, description: 'Invitation link has expired' }),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, accept_invitation_dto_1.AcceptInvitationDto]),
    __metadata("design:returntype", void 0)
], LosAuthController.prototype, "acceptInvitation", null);
exports.LosAuthController = LosAuthController = __decorate([
    (0, swagger_1.ApiTags)('LOS Auth'),
    (0, common_1.Controller)('los/auth'),
    __metadata("design:paramtypes", [los_auth_service_1.LosAuthService])
], LosAuthController);

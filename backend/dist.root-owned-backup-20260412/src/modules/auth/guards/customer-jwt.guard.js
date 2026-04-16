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
exports.CustomerJwtGuard = void 0;
const common_1 = require("@nestjs/common");
const customer_auth_service_1 = require("../services/customer-auth.service");
let CustomerJwtGuard = class CustomerJwtGuard {
    customerAuthService;
    constructor(customerAuthService) {
        this.customerAuthService = customerAuthService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const auth = await this.customerAuthService.authenticateRequest(request);
        if (!auth.authenticated && auth.reason !== 'invalid_token') {
            throw new common_1.UnauthorizedException('Missing authorization token');
        }
        if (!auth.authenticated) {
            this.customerAuthService.clearAuthCookie(response);
            throw new common_1.UnauthorizedException('Invalid or expired token');
        }
        request.customerUser = auth.customer;
        return true;
    }
};
exports.CustomerJwtGuard = CustomerJwtGuard;
exports.CustomerJwtGuard = CustomerJwtGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [customer_auth_service_1.CustomerAuthService])
], CustomerJwtGuard);

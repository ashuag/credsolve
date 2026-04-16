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
exports.CustomerAuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const auth_constants_1 = require("../auth.constants");
let CustomerAuthService = class CustomerAuthService {
    jwtService;
    cookieOptions;
    constructor(jwtService) {
        this.jwtService = jwtService;
        const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
        this.cookieOptions = {
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: auth_constants_1.CUSTOMER_AUTH_COOKIE_MAX_AGE_MS,
            ...(domain ? { domain } : {})
        };
    }
    async generateToken(customer) {
        const payload = {
            sub: customer.uuid,
            mobileNumber: customer.mobileNumber
        };
        return this.jwtService.signAsync(payload);
    }
    async authenticateRequest(request) {
        const token = this.extractToken(request);
        if (!token) {
            return { authenticated: false };
        }
        try {
            const customer = await this.jwtService.verifyAsync(token);
            return { authenticated: true, customer };
        }
        catch {
            return { authenticated: false, reason: 'invalid_token' };
        }
    }
    setAuthCookie(response, token) {
        response.cookie(auth_constants_1.CUSTOMER_AUTH_COOKIE_NAME, token, this.cookieOptions);
    }
    clearAuthCookie(response) {
        response.clearCookie(auth_constants_1.CUSTOMER_AUTH_COOKIE_NAME, this.cookieOptions);
    }
    extractToken(request) {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        if (type === 'Bearer' && token) {
            return token;
        }
        const cookieToken = request.cookies?.[auth_constants_1.CUSTOMER_AUTH_COOKIE_NAME];
        if (typeof cookieToken === 'string' && cookieToken.trim()) {
            return cookieToken;
        }
        return null;
    }
};
exports.CustomerAuthService = CustomerAuthService;
exports.CustomerAuthService = CustomerAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], CustomerAuthService);

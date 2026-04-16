"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerSessionModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const customer_jwt_guard_1 = require("./guards/customer-jwt.guard");
const customer_auth_service_1 = require("./services/customer-auth.service");
let CustomerSessionModule = class CustomerSessionModule {
};
exports.CustomerSessionModule = CustomerSessionModule;
exports.CustomerSessionModule = CustomerSessionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => ({
                    secret: configService.get('JWT_SECRET'),
                    signOptions: { expiresIn: '30d' },
                }),
                inject: [config_1.ConfigService],
            }),
        ],
        providers: [customer_auth_service_1.CustomerAuthService, customer_jwt_guard_1.CustomerJwtGuard],
        exports: [jwt_1.JwtModule, customer_auth_service_1.CustomerAuthService, customer_jwt_guard_1.CustomerJwtGuard],
    })
], CustomerSessionModule);

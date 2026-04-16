"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const mail_module_1 = require("../mail/mail.module");
const onboarding_module_1 = require("../onboarding/onboarding.module");
const auth_controller_1 = require("./auth.controller");
const customer_session_module_1 = require("./customer-session.module");
const otp_repository_1 = require("./repositories/otp.repository");
const google_oauth_service_1 = require("./services/google-oauth.service");
const otp_email_service_1 = require("./services/otp-email.service");
const otp_issuer_service_1 = require("./services/otp-issuer.service");
const otp_type_cache_service_1 = require("./services/otp-type-cache.service");
const get_otp_types_usecase_1 = require("./use-cases/get-otp-types.usecase");
const send_otp_usecase_1 = require("./use-cases/send-otp.usecase");
const verify_otp_usecase_1 = require("./use-cases/verify-otp.usecase");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            customer_session_module_1.CustomerSessionModule,
            onboarding_module_1.OnboardingModule,
            mail_module_1.MailModule,
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            otp_repository_1.OtpRepository,
            google_oauth_service_1.GoogleOAuthService,
            otp_email_service_1.OtpEmailService,
            otp_type_cache_service_1.OtpTypeCacheService,
            otp_issuer_service_1.OtpIssuerService,
            get_otp_types_usecase_1.GetOtpTypesUseCase,
            send_otp_usecase_1.SendOtpUseCase,
            verify_otp_usecase_1.VerifyOtpUseCase,
        ],
    })
], AuthModule);

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
var OtpEmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpEmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_constants_1 = require("../auth.constants");
const mail_configuration_exception_1 = require("../../mail/exceptions/mail-configuration.exception");
const mail_service_1 = require("../../mail/mail.service");
let OtpEmailService = OtpEmailService_1 = class OtpEmailService {
    mailService;
    configService;
    logger = new common_1.Logger(OtpEmailService_1.name);
    constructor(mailService, configService) {
        this.mailService = mailService;
        this.configService = configService;
    }
    async sendOtpEmail(email, otpCode) {
        if (!this.mailService.isConfigured()) {
            if (this.configService.get('NODE_ENV') === 'production') {
                throw new mail_configuration_exception_1.MailConfigurationException(this.mailService.getMissingConfigurationKeys().join(', '));
            }
            this.logger.warn(`Skipping OTP email delivery because SMTP configuration is incomplete: ${this.mailService.getMissingConfigurationKeys().join(', ')}.`);
            return false;
        }
        const expiryMinutes = Math.ceil(auth_constants_1.OTP_EXPIRY_SECONDS / 60);
        await this.mailService.send({
            to: email,
            subject: 'Your MoneyCash verification code',
            text: [
                'Your MoneyCash verification code is below.',
                '',
                `OTP: ${otpCode}`,
                `This code expires in ${expiryMinutes} minutes.`,
                `You can request a new code after ${auth_constants_1.OTP_RESEND_AFTER_SECONDS} seconds.`,
                '',
                'Do not share this code with anyone.'
            ].join('\n'),
            html: `
        <div style="font-family: Arial, sans-serif; color: #12244f; line-height: 1.6;">
          <p>Your MoneyCash verification code is below.</p>
          <div style="margin: 20px 0; display: inline-block; padding: 14px 20px; border-radius: 12px; background: #f4f8ff; border: 1px solid #d7e5ff; font-size: 28px; font-weight: 700; letter-spacing: 0.18em;">
            ${otpCode}
          </div>
          <p>This code expires in ${expiryMinutes} minutes.</p>
          <p>You can request a new code after ${auth_constants_1.OTP_RESEND_AFTER_SECONDS} seconds.</p>
          <p>Do not share this code with anyone.</p>
        </div>
      `
        });
        return true;
    }
};
exports.OtpEmailService = OtpEmailService;
exports.OtpEmailService = OtpEmailService = OtpEmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mail_service_1.MailService,
        config_1.ConfigService])
], OtpEmailService);

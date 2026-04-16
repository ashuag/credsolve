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
exports.LosUserInvitationService = void 0;
const common_1 = require("@nestjs/common");
const mail_configuration_exception_1 = require("../../mail/exceptions/mail-configuration.exception");
const mail_service_1 = require("../../mail/mail.service");
let LosUserInvitationService = class LosUserInvitationService {
    mailService;
    constructor(mailService) {
        this.mailService = mailService;
    }
    async sendInvitation(params) {
        if (!this.mailService.isConfigured()) {
            throw new mail_configuration_exception_1.MailConfigurationException(this.mailService.getMissingConfigurationKeys().join(', '));
        }
        const expiresAtLabel = params.expiresAt.toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
            hour12: true,
            timeZone: 'Asia/Kolkata',
        });
        const roleLine = params.roleName ? `Assigned role: ${params.roleName}` : 'Assigned role: Pending';
        await this.mailService.send({
            to: params.email,
            subject: 'Complete your MoneyCash LOS registration',
            text: [
                `Hello ${params.fullName},`,
                '',
                'Your MoneyCash LOS account is ready.',
                roleLine,
                '',
                'Use the one-time link below to set your password and complete registration:',
                params.invitationLink,
                '',
                `This link expires on ${expiresAtLabel}.`,
                'If the link has expired, ask your admin to create a new invitation.',
            ].join('\n'),
            html: `
        <div style="font-family: Arial, sans-serif; color: #12244f; line-height: 1.6;">
          <p>Hello ${params.fullName},</p>
          <p>Your MoneyCash LOS account is ready.</p>
          <p><strong>${roleLine}</strong></p>
          <p>Use the one-time link below to set your password and complete registration:</p>
          <p style="margin: 22px 0;">
            <a
              href="${params.invitationLink}"
              style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #1496f3; color: #ffffff; text-decoration: none; font-weight: 700;"
            >
              Set password
            </a>
          </p>
          <p style="word-break: break-all; font-size: 13px; color: #5e6782;">${params.invitationLink}</p>
          <p>This link expires on ${expiresAtLabel}.</p>
          <p>If the link has expired, ask your admin to create a new invitation.</p>
        </div>
      `,
        });
    }
};
exports.LosUserInvitationService = LosUserInvitationService;
exports.LosUserInvitationService = LosUserInvitationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mail_service_1.MailService])
], LosUserInvitationService);

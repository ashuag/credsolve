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
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require('nodemailer');
const logger_utils_1 = require("../../common/logging/logger.utils");
const mail_configuration_exception_1 = require("./exceptions/mail-configuration.exception");
const mail_delivery_exception_1 = require("./exceptions/mail-delivery.exception");
const REQUIRED_MAIL_CONFIG_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
let MailService = MailService_1 = class MailService {
    configService;
    logger = new common_1.Logger(MailService_1.name);
    transporter = null;
    constructor(configService) {
        this.configService = configService;
    }
    isConfigured() {
        return this.getMissingConfigurationKeys().length === 0;
    }
    getMissingConfigurationKeys() {
        return REQUIRED_MAIL_CONFIG_KEYS.filter((key) => !this.configService.get(key)?.trim());
    }
    async send(params) {
        const transporter = this.getTransporter();
        try {
            const info = await transporter.sendMail({
                from: params.from ?? this.getDefaultFromAddress(),
                to: params.to,
                subject: params.subject,
                text: params.text,
                ...(params.html ? { html: params.html } : {}),
                ...(params.replyTo ? { replyTo: params.replyTo } : {})
            });
            this.logger.log(`Email queued to ${Array.isArray(params.to) ? params.to.join(', ') : params.to}. Response: ${info.response}`);
        }
        catch (error) {
            (0, logger_utils_1.errorWithStack)(this.logger, `Failed to send email to ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`, error);
            throw new mail_delivery_exception_1.MailDeliveryException();
        }
    }
    getTransporter() {
        if (this.transporter) {
            return this.transporter;
        }
        const port = this.getRequiredPort();
        const secure = this.getSecureFlag(port);
        this.transporter = nodemailer.createTransport({
            host: this.getRequiredConfig('SMTP_HOST'),
            port,
            secure,
            auth: {
                user: this.getRequiredConfig('SMTP_USER'),
                pass: this.getRequiredConfig('SMTP_PASS')
            }
        });
        return this.transporter;
    }
    getDefaultFromAddress() {
        const fromAddress = this.configService.get('MAIL_FROM_ADDRESS')?.trim()
            || this.configService.get('SMTP_USER')?.trim();
        if (!fromAddress) {
            throw new mail_configuration_exception_1.MailConfigurationException('MAIL_FROM_ADDRESS');
        }
        const fromName = this.configService.get('MAIL_FROM_NAME')?.trim();
        return fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;
    }
    getRequiredConfig(key) {
        const value = this.configService.get(key)?.trim();
        if (!value) {
            throw new mail_configuration_exception_1.MailConfigurationException(key);
        }
        return value;
    }
    getRequiredPort() {
        const rawPort = this.getRequiredConfig('SMTP_PORT');
        const port = Number.parseInt(rawPort, 10);
        if (!Number.isInteger(port) || port <= 0) {
            throw new mail_configuration_exception_1.MailConfigurationException('SMTP_PORT');
        }
        return port;
    }
    getSecureFlag(port) {
        const value = this.configService.get('SMTP_SECURE')?.trim().toLowerCase();
        if (!value) {
            return port === 465;
        }
        return ['1', 'true', 'yes', 'on'].includes(value);
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);

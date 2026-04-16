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
exports.VerifyOtpDto = void 0;
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const otp_constants_1 = require("../../../../common/constants/otp.constants");
class VerifyOtpDto {
    type;
    requestId;
    otpCode;
}
exports.VerifyOtpDto = VerifyOtpDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: otp_constants_1.OTP_TYPE, example: otp_constants_1.OTP_TYPE.MOBILE }),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (typeof value === 'string') {
            return value.trim().toLowerCase();
        }
        return value;
    }),
    (0, class_validator_1.IsEnum)(otp_constants_1.OTP_TYPE),
    __metadata("design:type", String)
], VerifyOtpDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '9c8161a4-6df0-4e39-a6a4-2fa9f2f2fd22' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, {
        message: 'requestId must be a valid OTP request uuid.'
    }),
    __metadata("design:type", String)
], VerifyOtpDto.prototype, "requestId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '649756' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 6) : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{6}$/, { message: 'otpCode must be a 6-digit OTP.' }),
    __metadata("design:type", String)
], VerifyOtpDto.prototype, "otpCode", void 0);

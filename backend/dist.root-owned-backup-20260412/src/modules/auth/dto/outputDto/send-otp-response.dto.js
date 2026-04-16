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
exports.SendOtpResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class SendOtpResponseDto {
    requestId;
    maskedValue;
    resendAfterSeconds;
    resendAvailableAt;
    expiresAt;
    debugOtp;
}
exports.SendOtpResponseDto = SendOtpResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '9c8161a4-6df0-4e39-a6a4-2fa9f2f2fd22' }),
    __metadata("design:type", String)
], SendOtpResponseDto.prototype, "requestId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '88*** ***39' }),
    __metadata("design:type", String)
], SendOtpResponseDto.prototype, "maskedValue", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 30 }),
    __metadata("design:type", Number)
], SendOtpResponseDto.prototype, "resendAfterSeconds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-04T10:41:55.593Z' }),
    __metadata("design:type", String)
], SendOtpResponseDto.prototype, "resendAvailableAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-04T10:43:25.593Z' }),
    __metadata("design:type", String)
], SendOtpResponseDto.prototype, "expiresAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '649756' }),
    __metadata("design:type", String)
], SendOtpResponseDto.prototype, "debugOtp", void 0);

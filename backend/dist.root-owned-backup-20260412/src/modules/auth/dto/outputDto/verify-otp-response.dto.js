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
exports.VerifyOtpResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class VerifiedCustomerDto {
    id;
    uuid;
    mobileNumber;
    createdAt;
    leadUuid;
    leadEmail;
    leadStatus;
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1' }),
    __metadata("design:type", String)
], VerifiedCustomerDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '9c8161a4-6df0-4e39-a6a4-2fa9f2f2fd22' }),
    __metadata("design:type", String)
], VerifiedCustomerDto.prototype, "uuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '9876543210' }),
    __metadata("design:type", String)
], VerifiedCustomerDto.prototype, "mobileNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-05T06:41:55.593Z' }),
    __metadata("design:type", String)
], VerifiedCustomerDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'b3f1e2d4-8c9a-4b7e-a1f0-3d2c5e6f7a8b' }),
    __metadata("design:type", String)
], VerifiedCustomerDto.prototype, "leadUuid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'user@gmail.com', nullable: true }),
    __metadata("design:type", Object)
], VerifiedCustomerDto.prototype, "leadEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'EMAIL_VERIFIED' }),
    __metadata("design:type", String)
], VerifiedCustomerDto.prototype, "leadStatus", void 0);
class VerifyOtpResponseDto {
    success;
    requestId;
    verified;
    verifiedAt;
    leadId;
    leadStatus;
    customerId;
    mobileNumber;
    customer;
}
exports.VerifyOtpResponseDto = VerifyOtpResponseDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    __metadata("design:type", Boolean)
], VerifyOtpResponseDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '9c8161a4-6df0-4e39-a6a4-2fa9f2f2fd22' }),
    __metadata("design:type", String)
], VerifyOtpResponseDto.prototype, "requestId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    __metadata("design:type", Boolean)
], VerifyOtpResponseDto.prototype, "verified", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-04-05T06:41:55.593Z' }),
    __metadata("design:type", String)
], VerifyOtpResponseDto.prototype, "verifiedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'b3f1e2d4-8c9a-4b7e-a1f0-3d2c5e6f7a8b' }),
    __metadata("design:type", String)
], VerifyOtpResponseDto.prototype, "leadId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'EMAIL_VERIFIED' }),
    __metadata("design:type", String)
], VerifyOtpResponseDto.prototype, "leadStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '9c8161a4-6df0-4e39-a6a4-2fa9f2f2fd22' }),
    __metadata("design:type", String)
], VerifyOtpResponseDto.prototype, "customerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '8882911939' }),
    __metadata("design:type", String)
], VerifyOtpResponseDto.prototype, "mobileNumber", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: VerifiedCustomerDto }),
    __metadata("design:type", VerifiedCustomerDto)
], VerifyOtpResponseDto.prototype, "customer", void 0);

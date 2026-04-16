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
exports.SendOtpDto = void 0;
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const otp_constants_1 = require("../../../../common/constants/otp.constants");
function normalizeOptionalUtmValue(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
}
class SendOtpDto {
    type;
    value;
    utmSource;
    utmMedium;
    utmCampaign;
    utmTerm;
    utmContent;
}
exports.SendOtpDto = SendOtpDto;
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
], SendOtpDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        oneOf: [
            { type: 'integer', example: 8882911939 },
            { type: 'string', example: 'saurabh@gmail.com' }
        ]
    }),
    (0, class_validator_1.IsDefined)(),
    __metadata("design:type", Object)
], SendOtpDto.prototype, "value", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional UTM source value for attribution.' }),
    (0, class_transformer_1.Transform)(({ value }) => normalizeOptionalUtmValue(value)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SendOtpDto.prototype, "utmSource", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional UTM medium value for attribution.' }),
    (0, class_transformer_1.Transform)(({ value }) => normalizeOptionalUtmValue(value)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SendOtpDto.prototype, "utmMedium", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional UTM campaign value for attribution.' }),
    (0, class_transformer_1.Transform)(({ value }) => normalizeOptionalUtmValue(value)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SendOtpDto.prototype, "utmCampaign", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional UTM term value for attribution.' }),
    (0, class_transformer_1.Transform)(({ value }) => normalizeOptionalUtmValue(value)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SendOtpDto.prototype, "utmTerm", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional UTM content value for attribution.' }),
    (0, class_transformer_1.Transform)(({ value }) => normalizeOptionalUtmValue(value)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SendOtpDto.prototype, "utmContent", void 0);

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
exports.SyncLeadEmailDto = void 0;
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class SyncLeadEmailDto {
    leadUuid;
    email;
    emailVerified;
    verificationType;
}
exports.SyncLeadEmailDto = SyncLeadEmailDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'd47cfc0c-8e5b-4f5a-aa05-cab8d351ab36' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsUUID)('4', { message: 'leadUuid must be a valid UUID.' }),
    __metadata("design:type", String)
], SyncLeadEmailDto.prototype, "leadUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'customer@example.com' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    (0, class_validator_1.IsEmail)({}, { message: 'email must be a valid email address.' }),
    __metadata("design:type", String)
], SyncLeadEmailDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    (0, class_transformer_1.Transform)(({ value }) => value === true || value === 'true'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SyncLeadEmailDto.prototype, "emailVerified", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'otp', enum: ['otp', 'google'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    (0, class_validator_1.IsIn)(['otp', 'google'], { message: 'verificationType must be either otp or google.' }),
    __metadata("design:type", String)
], SyncLeadEmailDto.prototype, "verificationType", void 0);

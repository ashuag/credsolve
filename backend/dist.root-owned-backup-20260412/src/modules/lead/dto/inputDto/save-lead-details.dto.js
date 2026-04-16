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
exports.SaveLeadDetailsDto = void 0;
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const LEAD_GENDER_VALUES = ['male', 'female', 'others'];
const LEAD_OCCUPATION_VALUES = [
    'salaried',
    'self_employed_professional',
    'self_employed_business',
    'student',
    'homemaker',
    'retired'
];
const SELF_EMPLOYED_OCCUPATIONS = ['self_employed_professional', 'self_employed_business'];
function normalizeOptionalNumericValue(value) {
    if (typeof value !== 'string') {
        return value;
    }
    return value.replace(/\D/g, '').slice(0, 12);
}
class SaveLeadDetailsDto {
    leadUuid;
    fullName;
    dob;
    gender;
    occupation;
    currentCity;
    pincode;
    monthlyIncome;
    annualTurnover;
    annualProfit;
    creditConsentAccepted;
}
exports.SaveLeadDetailsDto = SaveLeadDetailsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'd47cfc0c-8e5b-4f5a-aa05-cab8d351ab36' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsUUID)('4', { message: 'leadUuid must be a valid UUID.' }),
    __metadata("design:type", String)
], SaveLeadDetailsDto.prototype, "leadUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Saurabh Sharma' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2, { message: 'fullName must be at least 2 characters long.' }),
    (0, class_validator_1.MaxLength)(100, { message: 'fullName must be at most 100 characters long.' }),
    __metadata("design:type", String)
], SaveLeadDetailsDto.prototype, "fullName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1995-08-17' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'dob must be in YYYY-MM-DD format.' }),
    __metadata("design:type", String)
], SaveLeadDetailsDto.prototype, "dob", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: LEAD_GENDER_VALUES, example: 'male' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    (0, class_validator_1.IsIn)(LEAD_GENDER_VALUES, { message: 'gender must be a supported value.' }),
    __metadata("design:type", Object)
], SaveLeadDetailsDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: LEAD_OCCUPATION_VALUES, example: 'salaried' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)),
    (0, class_validator_1.IsIn)(LEAD_OCCUPATION_VALUES, { message: 'occupation must be a supported value.' }),
    __metadata("design:type", Object)
], SaveLeadDetailsDto.prototype, "occupation", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Mumbai' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2, { message: 'currentCity must be at least 2 characters long.' }),
    (0, class_validator_1.MaxLength)(100, { message: 'currentCity must be at most 100 characters long.' }),
    __metadata("design:type", String)
], SaveLeadDetailsDto.prototype, "currentCity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '400001' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 6) : value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{6}$/, { message: 'pincode must be a valid 6-digit pincode.' }),
    __metadata("design:type", String)
], SaveLeadDetailsDto.prototype, "pincode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '65000' }),
    (0, class_validator_1.ValidateIf)(({ occupation }) => occupation === 'salaried'),
    (0, class_transformer_1.Transform)(({ value }) => normalizeOptionalNumericValue(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d+$/, { message: 'monthlyIncome must be a valid amount.' }),
    __metadata("design:type", String)
], SaveLeadDetailsDto.prototype, "monthlyIncome", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1200000' }),
    (0, class_validator_1.ValidateIf)(({ occupation }) => SELF_EMPLOYED_OCCUPATIONS.includes(occupation)),
    (0, class_transformer_1.Transform)(({ value }) => normalizeOptionalNumericValue(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d+$/, { message: 'annualTurnover must be a valid amount.' }),
    __metadata("design:type", String)
], SaveLeadDetailsDto.prototype, "annualTurnover", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '300000' }),
    (0, class_validator_1.ValidateIf)(({ occupation }) => SELF_EMPLOYED_OCCUPATIONS.includes(occupation)),
    (0, class_transformer_1.Transform)(({ value }) => normalizeOptionalNumericValue(value)),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d+$/, { message: 'annualProfit must be a valid amount.' }),
    __metadata("design:type", String)
], SaveLeadDetailsDto.prototype, "annualProfit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    (0, class_transformer_1.Transform)(({ value }) => value === true || value === 'true'),
    (0, class_validator_1.Equals)(true, { message: 'creditConsentAccepted must be accepted.' }),
    __metadata("design:type", Boolean)
], SaveLeadDetailsDto.prototype, "creditConsentAccepted", void 0);

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
exports.SaveProfessionalDetailsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const OCCUPATION_VALUES = [
    'salaried',
    'self_employed_professional',
    'self_employed_business',
    'student',
    'homemaker',
    'retired'
];
class SaveProfessionalDetailsDto {
    leadUuid;
    currentCity;
    pincode;
    occupation;
    monthlyIncome;
    annualTurnover;
    annualProfit;
}
exports.SaveProfessionalDetailsDto = SaveProfessionalDetailsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'b3f1e2d4-8c9a-4b7e-a1f0-3d2c5e6f7a8b' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveProfessionalDetailsDto.prototype, "leadUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Mumbai' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveProfessionalDetailsDto.prototype, "currentCity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '400001' }),
    (0, class_validator_1.Matches)(/^\d{6}$/, { message: 'pincode must be exactly 6 digits' }),
    __metadata("design:type", String)
], SaveProfessionalDetailsDto.prototype, "pincode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'salaried', enum: OCCUPATION_VALUES }),
    (0, class_validator_1.IsIn)(OCCUPATION_VALUES),
    __metadata("design:type", Object)
], SaveProfessionalDetailsDto.prototype, "occupation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '50000' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d+(\.\d+)?$/, { message: 'monthlyIncome must be a numeric value' }),
    __metadata("design:type", String)
], SaveProfessionalDetailsDto.prototype, "monthlyIncome", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '1200000' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d+(\.\d+)?$/, { message: 'annualTurnover must be a numeric value' }),
    __metadata("design:type", String)
], SaveProfessionalDetailsDto.prototype, "annualTurnover", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '300000' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d+(\.\d+)?$/, { message: 'annualProfit must be a numeric value' }),
    __metadata("design:type", String)
], SaveProfessionalDetailsDto.prototype, "annualProfit", void 0);

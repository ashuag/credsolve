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
exports.SaveApplicationDetailsDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class SaveApplicationDetailsDto {
    leadUuid;
    fullName;
    gender;
    dob;
    get dateOfBirth() {
        const [year, month, day] = this.dob.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day));
    }
    panNumber;
}
exports.SaveApplicationDetailsDto = SaveApplicationDetailsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'b3f1e2d4-8c9a-4b7e-a1f0-3d2c5e6f7a8b' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveApplicationDetailsDto.prototype, "leadUuid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Saurabh Kumar' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveApplicationDetailsDto.prototype, "fullName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'male', enum: ['male', 'female', 'others'] }),
    (0, class_validator_1.IsIn)(['male', 'female', 'others']),
    __metadata("design:type", String)
], SaveApplicationDetailsDto.prototype, "gender", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1995-07-20', description: 'YYYY-MM-DD' }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'dob must be in YYYY-MM-DD format' }),
    __metadata("design:type", String)
], SaveApplicationDetailsDto.prototype, "dob", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ABCDE1234F' }),
    (0, class_validator_1.Matches)(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'panNumber must be a valid PAN (e.g. ABCDE1234F)' }),
    __metadata("design:type", String)
], SaveApplicationDetailsDto.prototype, "panNumber", void 0);

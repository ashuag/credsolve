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
exports.LookupValuesResponseDto = exports.LookupValueDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class LookupValueDto {
    id;
    name;
}
exports.LookupValueDto = LookupValueDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    __metadata("design:type", Number)
], LookupValueDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Male' }),
    __metadata("design:type", String)
], LookupValueDto.prototype, "name", void 0);
class LookupValuesResponseDto {
    values;
}
exports.LookupValuesResponseDto = LookupValuesResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [LookupValueDto] }),
    __metadata("design:type", Array)
], LookupValuesResponseDto.prototype, "values", void 0);

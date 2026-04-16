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
exports.LookupsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const lookup_values_response_dto_1 = require("./dto/outputDto/lookup-values-response.dto");
const lookups_service_1 = require("./lookups.service");
let LookupsController = class LookupsController {
    lookupsService;
    constructor(lookupsService) {
        this.lookupsService = lookupsService;
    }
    getGenders() {
        return this.lookupsService.getGenders();
    }
    getOccupations() {
        return this.lookupsService.getOccupations();
    }
    getCities() {
        return this.lookupsService.getCities();
    }
};
exports.LookupsController = LookupsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get active gender values' }),
    (0, swagger_1.ApiOkResponse)({ type: lookup_values_response_dto_1.LookupValuesResponseDto }),
    (0, common_1.Get)('gender'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LookupsController.prototype, "getGenders", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get active occupation values' }),
    (0, swagger_1.ApiOkResponse)({ type: lookup_values_response_dto_1.LookupValuesResponseDto }),
    (0, common_1.Get)('occupations'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LookupsController.prototype, "getOccupations", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get active city values' }),
    (0, swagger_1.ApiOkResponse)({ type: lookup_values_response_dto_1.LookupValuesResponseDto }),
    (0, common_1.Get)('cities'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LookupsController.prototype, "getCities", null);
exports.LookupsController = LookupsController = __decorate([
    (0, swagger_1.ApiTags)('Lookups'),
    (0, common_1.Controller)('lookup'),
    __metadata("design:paramtypes", [lookups_service_1.LookupsService])
], LookupsController);

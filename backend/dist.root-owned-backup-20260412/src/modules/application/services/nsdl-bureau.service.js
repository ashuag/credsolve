"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NsdlBureauService = void 0;
const common_1 = require("@nestjs/common");
/**
 * NSDL / CIBIL bureau service.
 * NOT YET IMPLEMENTED — returns undefined until the API integration is ready.
 * The eligibility service falls back to a mock when this returns undefined.
 */
let NsdlBureauService = class NsdlBureauService {
    async fetchReport(_panNumber, _fullName) {
        // TODO: integrate NSDL / CIBIL bureau API here.
        return undefined;
    }
};
exports.NsdlBureauService = NsdlBureauService;
exports.NsdlBureauService = NsdlBureauService = __decorate([
    (0, common_1.Injectable)()
], NsdlBureauService);

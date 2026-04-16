"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanVerificationService = void 0;
const common_1 = require("@nestjs/common");
/**
 * Mock PAN verification service.
 * Distribution: 70% verified, 10% not_found, 8% name_mismatch, 7% bureau_error, 5% blacklisted.
 * Replace with real NSDL/bureau integration later.
 */
let PanVerificationService = class PanVerificationService {
    async verify(_panNumber, _fullName) {
        const rand = Math.random();
        if (rand < 0.70)
            return { status: 'verified' };
        if (rand < 0.80)
            return { status: 'not_found' };
        if (rand < 0.88)
            return { status: 'name_mismatch' };
        if (rand < 0.95)
            return { status: 'bureau_error' };
        return { status: 'blacklisted' };
    }
};
exports.PanVerificationService = PanVerificationService;
exports.PanVerificationService = PanVerificationService = __decorate([
    (0, common_1.Injectable)()
], PanVerificationService);

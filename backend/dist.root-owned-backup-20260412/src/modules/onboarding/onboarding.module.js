"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingModule = void 0;
const common_1 = require("@nestjs/common");
const customer_module_1 = require("../customer/customer.module");
const lead_module_1 = require("../lead/lead.module");
const complete_onboarding_usecase_1 = require("./use-cases/complete-onboarding.usecase");
let OnboardingModule = class OnboardingModule {
};
exports.OnboardingModule = OnboardingModule;
exports.OnboardingModule = OnboardingModule = __decorate([
    (0, common_1.Module)({
        imports: [customer_module_1.CustomerModule, lead_module_1.LeadModule],
        providers: [complete_onboarding_usecase_1.CompleteOnboardingUseCase],
        exports: [complete_onboarding_usecase_1.CompleteOnboardingUseCase]
    })
], OnboardingModule);

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationModule = void 0;
const common_1 = require("@nestjs/common");
const customer_session_module_1 = require("../auth/customer-session.module");
const lead_module_1 = require("../lead/lead.module");
const customer_application_controller_1 = require("./controllers/customer-application.controller");
const application_details_repository_1 = require("./repositories/application-details.repository");
const application_repository_1 = require("./repositories/application.repository");
const application_status_repository_1 = require("./repositories/application-status.repository");
const application_service_1 = require("./services/application.service");
const pan_verification_service_1 = require("./services/pan-verification.service");
const nsdl_bureau_service_1 = require("./services/nsdl-bureau.service");
const eligibility_service_1 = require("./services/eligibility.service");
const eligibility_criteria_repository_1 = require("./repositories/eligibility-criteria.repository");
const credit_limit_tier_repository_1 = require("./repositories/credit-limit-tier.repository");
const application_eligibility_repository_1 = require("./repositories/application-eligibility.repository");
let ApplicationModule = class ApplicationModule {
};
exports.ApplicationModule = ApplicationModule;
exports.ApplicationModule = ApplicationModule = __decorate([
    (0, common_1.Module)({
        imports: [customer_session_module_1.CustomerSessionModule, (0, common_1.forwardRef)(() => lead_module_1.LeadModule)],
        controllers: [customer_application_controller_1.CustomerApplicationController],
        providers: [
            application_repository_1.ApplicationRepository,
            application_status_repository_1.ApplicationStatusRepository,
            application_details_repository_1.ApplicationDetailsRepository,
            application_eligibility_repository_1.ApplicationEligibilityRepository,
            eligibility_criteria_repository_1.EligibilityCriteriaRepository,
            credit_limit_tier_repository_1.CreditLimitTierRepository,
            application_service_1.ApplicationService,
            pan_verification_service_1.PanVerificationService,
            nsdl_bureau_service_1.NsdlBureauService,
            eligibility_service_1.EligibilityService,
        ],
        exports: [application_service_1.ApplicationService, eligibility_criteria_repository_1.EligibilityCriteriaRepository, credit_limit_tier_repository_1.CreditLimitTierRepository]
    })
], ApplicationModule);

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
exports.EligibilityService = void 0;
const common_1 = require("@nestjs/common");
const nsdl_bureau_service_1 = require("./nsdl-bureau.service");
const eligibility_criteria_repository_1 = require("../repositories/eligibility-criteria.repository");
const credit_limit_tier_repository_1 = require("../repositories/credit-limit-tier.repository");
// ── Mock bureau report ─────────────────────────────────────────────────────────
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function chance(probability) {
    return Math.random() < probability;
}
function buildMockReport() {
    const isNtc = chance(0.08); // 8% NTC
    return {
        isNtc,
        cibilScore: isNtc ? undefined : randomInt(580, 900),
        totalUnsecuredLimit: randomInt(0, 3_000_000),
        hasOpenDpd6Months: chance(0.07),
        hasDpd30In3Months: chance(0.06),
        hasDpd60In9Months: chance(0.05),
        hasDpd90In12Months: chance(0.05),
        hasAdverseIn18Months: chance(0.04),
        hasRestructuredLoan: chance(0.04),
        hasSmaOrPwos: chance(0.04),
        hasActiveMfi: chance(0.06),
        enquiriesLast30Days: randomInt(0, 15),
    };
}
// ── Eligibility check ──────────────────────────────────────────────────────────
let EligibilityService = class EligibilityService {
    nsdlBureauService;
    eligibilityCriteriaRepository;
    creditLimitTierRepository;
    constructor(nsdlBureauService, eligibilityCriteriaRepository, creditLimitTierRepository) {
        this.nsdlBureauService = nsdlBureauService;
        this.eligibilityCriteriaRepository = eligibilityCriteriaRepository;
        this.creditLimitTierRepository = creditLimitTierRepository;
    }
    async check(params) {
        // 1. Fetch criteria from DB
        const criteria = await this.eligibilityCriteriaRepository.findAllActive();
        const get = (key, fallback) => criteria.find(c => c.key === key)?.value ?? fallback;
        const cibilMinNew = parseInt(get('cibil_min_new', '700'), 10);
        const cibilMinExisting = parseInt(get('cibil_min_existing', '650'), 10);
        const cibilMax = parseInt(get('cibil_max', '900'), 10);
        const ntcAllowed = get('ntc_allowed', 'false') === 'true';
        const minAge = parseInt(get('min_age', '21'), 10);
        const maxAge = parseInt(get('max_age', '58'), 10);
        const openDpdMonths = parseInt(get('open_dpd_months', '6'), 10);
        const dpd30Months = parseInt(get('dpd_30plus_months', '3'), 10);
        const dpd60Months = parseInt(get('dpd_60plus_months', '9'), 10);
        const dpd90Months = parseInt(get('dpd_90plus_months', '12'), 10);
        const settledMonths = parseInt(get('settled_months', '18'), 10);
        const noRestructured = get('no_restructured_loans', 'true') === 'true';
        const noSmaPwos = get('no_sma_pwos', 'true') === 'true';
        const noActiveMfi = get('no_active_mfi', 'true') === 'true';
        const maxEnquiries30Days = parseInt(get('max_enquiries_30_days', '10'), 10);
        // 2. Try live bureau; fall back to mock
        const report = (await this.nsdlBureauService.fetchReport(params.panNumber, params.fullName))
            ?? buildMockReport();
        const cibilScore = report.cibilScore;
        const cibilMin = params.isExistingCustomer ? cibilMinExisting : cibilMinNew;
        // 3. Run eligibility rules in order (first failure wins)
        const fail = (reason) => ({
            isEligible: false,
            approvedAmount: undefined,
            cibilScore,
            ineligibleReason: reason,
        });
        if (!ntcAllowed && report.isNtc) {
            return fail('NTC (New to Credit) customers are not currently eligible.');
        }
        if (cibilScore !== undefined && cibilScore < cibilMin) {
            return fail(`CIBIL score ${cibilScore} is below the required minimum of ${cibilMin}.`);
        }
        if (cibilScore !== undefined && cibilScore > cibilMax) {
            return fail(`CIBIL score ${cibilScore} exceeds the maximum ceiling of ${cibilMax}.`);
        }
        if (params.ageAtApplication < minAge) {
            return fail(`Applicant age ${params.ageAtApplication} is below the minimum of ${minAge} years.`);
        }
        if (params.ageAtApplication > maxAge) {
            return fail(`Applicant age ${params.ageAtApplication} exceeds the maximum of ${maxAge} years at end of tenure.`);
        }
        if (report.hasOpenDpd6Months) {
            return fail(`Open DPD detected within the last ${openDpdMonths} months.`);
        }
        if (report.hasDpd30In3Months) {
            return fail(`30+ DPD detected within the last ${dpd30Months} months.`);
        }
        if (report.hasDpd60In9Months) {
            return fail(`60+ DPD detected within the last ${dpd60Months} months.`);
        }
        if (report.hasDpd90In12Months) {
            return fail(`90+ DPD detected within the last ${dpd90Months} months.`);
        }
        if (report.hasAdverseIn18Months) {
            return fail(`Doubtful / Loss / Written-off / Settled status within the last ${settledMonths} months.`);
        }
        if (noRestructured && report.hasRestructuredLoan) {
            return fail('Restructured loan trades are not permitted.');
        }
        if (noSmaPwos && report.hasSmaOrPwos) {
            return fail('SMA or PWOS trade lines are not permitted.');
        }
        if (noActiveMfi && report.hasActiveMfi) {
            return fail('Active MFI loan detected — not permitted.');
        }
        if (report.enquiriesLast30Days > maxEnquiries30Days) {
            return fail(`${report.enquiriesLast30Days} enquiries in the last 30 days exceeds the limit of ${maxEnquiries30Days}.`);
        }
        // 4. Customer is eligible — determine approved amount from credit limit tier
        const tier = await this.creditLimitTierRepository.findTierForLimit(report.totalUnsecuredLimit);
        if (!tier) {
            return fail('Unsecured credit limit is below the minimum qualifying threshold.');
        }
        return {
            isEligible: true,
            approvedAmount: tier.maxBulletLoan,
            cibilScore,
            ineligibleReason: undefined,
        };
    }
};
exports.EligibilityService = EligibilityService;
exports.EligibilityService = EligibilityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nsdl_bureau_service_1.NsdlBureauService,
        eligibility_criteria_repository_1.EligibilityCriteriaRepository,
        credit_limit_tier_repository_1.CreditLimitTierRepository])
], EligibilityService);

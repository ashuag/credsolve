"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gender_seed_1 = require("./seeds/gender.seed");
const occupation_seed_1 = require("./seeds/occupation.seed");
const otp_type_seed_1 = require("./seeds/otp-type.seed");
const user_role_seed_1 = require("./seeds/user-role.seed");
const user_seed_1 = require("./seeds/user.seed");
const prisma_client_1 = require("./prisma-client");
const lead_status_seed_1 = require("./seeds/lead_status.seed");
const state_seed_1 = require("./seeds/state.seed");
const city_seed_1 = require("./seeds/city.seed");
const application_status_seed_1 = require("./seeds/application_status.seed");
const loanReason_seed_1 = require("./seeds/loanReason.seed");
const setting_seed_1 = require("./seeds/setting.seed");
const eligibility_criteria_seed_1 = require("./seeds/eligibility-criteria.seed");
const credit_limit_tier_seed_1 = require("./seeds/credit-limit-tier.seed");
async function waitForDatabase(prisma) {
    const maxAttempts = Number(process.env.SEED_DB_MAX_ATTEMPTS ?? 15);
    const retryDelayMs = Number(process.env.SEED_DB_RETRY_DELAY_MS ?? 2_000);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await prisma.$connect();
            await prisma.$queryRawUnsafe('SELECT 1');
            return;
        }
        catch (error) {
            if (attempt >= maxAttempts) {
                throw error;
            }
            console.log(`Database not ready yet (attempt ${attempt}/${maxAttempts}). Retrying in ${retryDelayMs}ms...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
    }
}
async function main() {
    const prisma = (0, prisma_client_1.createPrismaClient)();
    try {
        console.log('Starting seed...');
        const start = Date.now();
        await waitForDatabase(prisma);
        await (0, gender_seed_1.seedGender)(prisma);
        await (0, occupation_seed_1.seedOccupation)(prisma);
        await (0, otp_type_seed_1.seedOtpType)(prisma);
        await (0, lead_status_seed_1.seedLeadStatus)(prisma);
        await (0, state_seed_1.seedState)(prisma);
        await (0, city_seed_1.seedCity)(prisma);
        await (0, user_role_seed_1.seedUserRole)(prisma);
        await (0, user_seed_1.seedUser)(prisma);
        await (0, application_status_seed_1.seedApplicationStatus)(prisma);
        await (0, loanReason_seed_1.seedLoanReason)(prisma);
        await (0, setting_seed_1.seedSetting)(prisma);
        await (0, eligibility_criteria_seed_1.seedEligibilityCriteria)(prisma);
        await (0, credit_limit_tier_seed_1.seedCreditLimitTier)(prisma);
        console.log(`Seed completed in ${Date.now() - start}ms`);
    }
    catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();

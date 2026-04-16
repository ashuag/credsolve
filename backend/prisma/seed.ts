import {seedGender} from './seeds/gender.seed';
import {seedOccupation} from './seeds/occupation.seed';
import {seedOtpType} from './seeds/otp-type.seed';
import {seedUserRole} from './seeds/user-role.seed';
import {seedUser} from './seeds/user.seed';
import {createPrismaClient} from './prisma-client';
import {seedLeadStatus} from "./seeds/lead_status.seed";
import {seedState} from './seeds/state.seed';
import {seedCity} from './seeds/city.seed';
import {seedApplicationStatus} from "./seeds/application_status.seed";
import {seedLoanReason} from "./seeds/loanReason.seed";
import {seedSetting} from "./seeds/setting.seed";
import {seedEligibilityCriteria} from './seeds/eligibility-criteria.seed';
import {seedCreditLimitTier} from './seeds/credit-limit-tier.seed';

async function waitForDatabase(prisma: ReturnType<typeof createPrismaClient>) {
    const maxAttempts = Number(process.env.SEED_DB_MAX_ATTEMPTS ?? 15);
    const retryDelayMs = Number(process.env.SEED_DB_RETRY_DELAY_MS ?? 2_000);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            await prisma.$connect();
            await prisma.$queryRawUnsafe('SELECT 1');
            return;
        } catch (error) {
            if (attempt >= maxAttempts) {
                throw error;
            }

            console.log(
                `Database not ready yet (attempt ${attempt}/${maxAttempts}). Retrying in ${retryDelayMs}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
    }
}

async function main() {
    const prisma = createPrismaClient();

    try {
        console.log('Starting seed...');
        const start = Date.now();
        await waitForDatabase(prisma);

        await seedGender(prisma);
        await seedOccupation(prisma);
        await seedOtpType(prisma);
        await seedLeadStatus(prisma);
        await seedState(prisma);
        await seedCity(prisma);
        await seedUserRole(prisma);
        await seedUser(prisma);
        await seedApplicationStatus(prisma);
        await seedLoanReason(prisma);
        await seedSetting(prisma);
        await seedEligibilityCriteria(prisma);
        await seedCreditLimitTier(prisma);

        console.log(`Seed completed in ${Date.now() - start}ms`);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();

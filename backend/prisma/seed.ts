import {seedGender} from './seeds/gender.seed';
import {seedOccupation} from './seeds/occupation.seed';
import {seedOtpType} from './seeds/otp-type.seed';
import {seedUserRole} from './seeds/user-role.seed';
import {seedUser} from './seeds/user.seed';
import {createPrismaClient} from './prisma-client';
import {seedLeadStatus} from "./seeds/lead_status.seed";
import {seedState} from './seeds/state.seed';
import {seedApplicationStatus} from "./seeds/application_status.seed";
import {seedLoanReason} from "./seeds/loanReason.seed";
import {seedSetting} from "./seeds/setting.seed";
import {seedEligibilityCriteria} from './seeds/eligibility-criteria.seed';
import {seedCreditLimitTier} from './seeds/credit-limit-tier.seed';
import { seedBank } from './seeds/bank.seed';
import { seedRejectionReason } from './seeds/rejection-reason.seed';
import { seedReferenceRelation } from './seeds/reference-relation.seed';
import { seedSmsTemplate } from './seeds/sms-template.seed';

async function assertMigrationsApplied(prisma: ReturnType<typeof createPrismaClient>) {
    const rows = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'gender'
  `;
    const cnt = Number(rows[0]?.cnt ?? 0);
    if (cnt === 0) {
        throw new Error(
            'Database has no application tables (e.g. `gender` is missing). Run migrations before seeding:\n' +
                '  npm run prisma:migrate:deploy\n' +
                'If you use Docker Compose, ensure the backend startup runs `prisma:migrate:deploy` before `npm run seed`.'
        );
    }
}

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
        await assertMigrationsApplied(prisma);

        await seedGender(prisma);
        await seedOccupation(prisma);
        await seedOtpType(prisma);
        await seedLeadStatus(prisma);
        await seedState(prisma);
        await seedUserRole(prisma);
        await seedUser(prisma);
        await seedApplicationStatus(prisma);
        await seedLoanReason(prisma);
        await seedSetting(prisma);
        await seedEligibilityCriteria(prisma);
        await seedCreditLimitTier(prisma);
        await seedBank(prisma);
        await seedRejectionReason(prisma);
        await seedReferenceRelation(prisma);
        await seedSmsTemplate(prisma);

        console.log(`Seed completed in ${Date.now() - start}ms`);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();

import type {Prisma} from '@prisma/client';
import {GENDER} from '../../src/common/constants/gender.constants';

export async function seedGender(prisma: Prisma.TransactionClient) {
    for (const name of Object.values(GENDER)) {
        await prisma.$executeRaw`
            INSERT INTO \`gender\` (name, is_active)
            VALUES (${name}, 1)
            ON DUPLICATE KEY UPDATE
                is_active = VALUES(is_active)
        `;
    }

    console.log('Gender seeded');
}

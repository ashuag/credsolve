// prisma/seeders/state.seeder.ts

import type {Prisma} from '@prisma/client';
import {INDIAN_STATES} from '../../src/common/constants/state.constant';

export async function seedState(prisma: Prisma.TransactionClient) {
    for (const {name, code} of INDIAN_STATES) {
        await prisma.$executeRaw`
            INSERT INTO \`state\` (name, code, is_active)
            VALUES (${name}, ${code}, 1)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                is_active = VALUES(is_active)
        `;
    }

    console.log('State seeded');
}

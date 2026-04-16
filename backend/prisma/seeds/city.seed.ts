import type {Prisma} from '@prisma/client';
import {INDIAN_CITIES} from '../../src/common/constants/city.constants';

export async function seedCity(prisma: Prisma.TransactionClient) {
    for (const {id, name, stateId} of INDIAN_CITIES) {
        await prisma.$executeRaw`
            INSERT INTO city (id, name, state_id, is_active)
            VALUES (${id}, ${name}, ${stateId}, 1)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                state_id = VALUES(state_id),
                is_active = VALUES(is_active)
        `;
    }

    console.log('City seeded');
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCity = seedCity;
const city_constants_1 = require("../../src/common/constants/city.constants");
async function seedCity(prisma) {
    for (const { id, name, stateId } of city_constants_1.INDIAN_CITIES) {
        await prisma.$executeRaw `
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

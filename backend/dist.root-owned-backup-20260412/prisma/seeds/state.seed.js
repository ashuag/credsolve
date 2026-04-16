"use strict";
// prisma/seeders/state.seeder.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedState = seedState;
const state_constant_1 = require("../../src/common/constants/state.constant");
async function seedState(prisma) {
    for (const { name, code } of state_constant_1.INDIAN_STATES) {
        await prisma.$executeRaw `
            INSERT INTO \`state\` (name, code, is_active)
            VALUES (${name}, ${code}, 1)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                is_active = VALUES(is_active)
        `;
    }
    console.log('State seeded');
}

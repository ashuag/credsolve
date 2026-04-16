"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedGender = seedGender;
const gender_constants_1 = require("../../src/common/constants/gender.constants");
async function seedGender(prisma) {
    for (const name of Object.values(gender_constants_1.GENDER)) {
        await prisma.$executeRaw `
            INSERT INTO \`gender\` (name, is_active)
            VALUES (${name}, 1)
            ON DUPLICATE KEY UPDATE
                is_active = VALUES(is_active)
        `;
    }
    console.log('Gender seeded');
}

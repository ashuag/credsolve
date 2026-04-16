"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedOccupation = seedOccupation;
const occupation_constants_1 = require("../../src/common/constants/occupation.constants");
async function seedOccupation(prisma) {
    for (const name of Object.values(occupation_constants_1.OCCUPATION)) {
        await prisma.$executeRaw `
      INSERT INTO \`occupation\` (name, is_active)
      VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active)
    `;
    }
    console.log('Occupation seeded');
}

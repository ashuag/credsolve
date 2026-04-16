"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedApplicationStatus = seedApplicationStatus;
const application_constants_1 = require("../../src/common/constants/application.constants");
async function seedApplicationStatus(prisma) {
    for (const name of Object.values(application_constants_1.APPLICATION_STATUS)) {
        await prisma.$executeRaw `
      INSERT INTO \`application_status\` (name, is_active)
      VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active)
    `;
    }
    console.log('Application status seeded');
}

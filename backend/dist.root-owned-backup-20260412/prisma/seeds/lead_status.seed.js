"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedLeadStatus = seedLeadStatus;
const lead_constants_1 = require("../../src/common/constants/lead.constants");
async function seedLeadStatus(prisma) {
    for (const name of Object.values(lead_constants_1.LEAD_STATUS)) {
        await prisma.$executeRaw `
      INSERT INTO \`lead_status\` (name, is_active)
      VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active)
    `;
    }
    console.log('Lead status seeded');
}

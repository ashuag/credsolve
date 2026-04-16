"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedLoanReason = seedLoanReason;
const loanReason_constants_1 = require("../../src/common/constants/loanReason.constants");
async function seedLoanReason(prisma) {
    for (const name of Object.values(loanReason_constants_1.LoanReason)) {
        await prisma.$executeRaw `
      INSERT INTO \`reason_for_loan\` (name, is_active)
      VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active)
    `;
    }
    console.log('Reason for Loan seeded');
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedOtpType = seedOtpType;
const otp_constants_1 = require("../../src/common/constants/otp.constants");
async function seedOtpType(prisma) {
    for (const name of Object.values(otp_constants_1.OTP_TYPE)) {
        await prisma.$executeRaw `
      INSERT INTO \`otp_type\` (name, is_active)
      VALUES (${name}, 1)
      ON DUPLICATE KEY UPDATE
        is_active = VALUES(is_active)
    `;
    }
    console.log('OtpType seeded');
}

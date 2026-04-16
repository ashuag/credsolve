"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedUser = seedUser;
const bcrypt = __importStar(require("bcrypt"));
async function seedUser(prisma) {
    const password = process.env.DEFAULT_STAFF_PASSWORD || 'Secret123!';
    const hashedPassword = bcrypt.hashSync(password, 10);
    const users = [
        {
            fullName: 'MoneyCash Admin',
            email: 'admin@moneycash.test',
            password: hashedPassword,
            roleId: 1,
        }
    ];
    for (const user of users) {
        await prisma.$executeRaw `
      INSERT INTO \`user\` (full_name, email, password, role_id, is_active, updated_at)
      VALUES (${user.fullName}, ${user.email}, ${user.password}, ${user.roleId}, 1, NOW(3))
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        password = VALUES(password),
        role_id = VALUES(role_id),
        is_active = VALUES(is_active),
        registration_completed_at = NOW(3),
        updated_at = NOW(3)
    `;
    }
    console.log('Users seeded');
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedUserRole = seedUserRole;
const USER_ROLES = [
    { id: 1, name: 'ADMIN', hierarchyLevel: 1 },
    { id: 2, name: 'Team Lead', hierarchyLevel: 2 },
    { id: 3, name: 'Agent', hierarchyLevel: 3 }
];
async function seedUserRole(prisma) {
    for (const role of USER_ROLES) {
        await prisma.$executeRaw `
      INSERT INTO \`user_role\` (id, name, hierarchy_level, is_active)
      VALUES (${role.id}, ${role.name}, ${role.hierarchyLevel}, 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        hierarchy_level = VALUES(hierarchy_level),
        is_active = VALUES(is_active)
    `;
    }
    console.log('UserRole seeded');
}

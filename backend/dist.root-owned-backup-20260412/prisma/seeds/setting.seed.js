"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedSetting = seedSetting;
const setting_constants_1 = require("../../src/common/constants/setting.constants");
async function seedSetting(prisma) {
    for (const setting of Object.values(setting_constants_1.SettingKey)) {
        await prisma.setting.upsert({
            where: { key: setting.key },
            update: {
                value: setting.default,
                description: setting.description,
                isActive: true
            },
            create: {
                key: setting.key,
                value: setting.default,
                description: setting.description,
                isActive: true
            }
        });
    }
    console.log(`Settings seeded (${Object.values(setting_constants_1.SettingKey).length} records)`);
}

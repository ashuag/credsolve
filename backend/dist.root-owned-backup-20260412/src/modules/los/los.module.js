"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LosModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const mail_module_1 = require("../mail/mail.module");
const lookups_module_1 = require("../lookups/lookups.module");
const prisma_module_1 = require("../../../prisma/prisma.module");
const application_module_1 = require("../application/application.module");
const los_applications_controller_1 = require("./applications/los-applications.controller");
const los_applications_service_1 = require("./applications/los-applications.service");
const los_auth_controller_1 = require("./auth/los-auth.controller");
const los_auth_service_1 = require("./auth/los-auth.service");
const los_dashboard_controller_1 = require("./dashboard/los-dashboard.controller");
const los_dashboard_service_1 = require("./dashboard/los-dashboard.service");
const los_leads_controller_1 = require("./leads/los-leads.controller");
const los_leads_service_1 = require("./leads/los-leads.service");
const los_masters_controller_1 = require("./masters/los-masters.controller");
const los_masters_service_1 = require("./masters/los-masters.service");
const los_roles_controller_1 = require("./roles/los-roles.controller");
const los_roles_service_1 = require("./roles/los-roles.service");
const los_users_controller_1 = require("./users/los-users.controller");
const los_user_invitation_service_1 = require("./users/los-user-invitation.service");
const los_users_service_1 = require("./users/los-users.service");
let LosModule = class LosModule {
};
exports.LosModule = LosModule;
exports.LosModule = LosModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            mail_module_1.MailModule,
            lookups_module_1.LookupsModule,
            (0, common_1.forwardRef)(() => application_module_1.ApplicationModule),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => ({
                    secret: configService.get('JWT_SECRET'),
                    signOptions: { expiresIn: '1d' },
                }),
                inject: [config_1.ConfigService],
            }),
        ],
        controllers: [
            los_auth_controller_1.LosAuthController,
            los_users_controller_1.LosUsersController,
            los_roles_controller_1.LosRolesController,
            los_dashboard_controller_1.LosDashboardController,
            los_leads_controller_1.LosLeadsController,
            los_applications_controller_1.LosApplicationsController,
            los_masters_controller_1.LosMastersController,
        ],
        providers: [
            los_auth_service_1.LosAuthService,
            los_users_service_1.LosUsersService,
            los_roles_service_1.LosRolesService,
            los_user_invitation_service_1.LosUserInvitationService,
            los_dashboard_service_1.LosDashboardService,
            los_leads_service_1.LosLeadsService,
            los_applications_service_1.LosApplicationsService,
            los_masters_service_1.LosMastersService,
        ],
        exports: [los_auth_service_1.LosAuthService],
    })
], LosModule);

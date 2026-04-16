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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LosAuthService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../../../../prisma/prisma.service");
const bcrypt = __importStar(require("bcrypt"));
const serialize_los_user_1 = require("../utils/serialize-los-user");
let LosAuthService = class LosAuthService {
    prisma;
    jwtService;
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            include: { userRole: true },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (!user.password) {
            throw new common_1.UnauthorizedException('Complete your registration from the invitation email first.');
        }
        if (!user.isActive) {
            throw new common_1.UnauthorizedException('This account is inactive.');
        }
        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const loggedInUser = await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
            include: { userRole: true },
        });
        const serializedUser = (0, serialize_los_user_1.serializeLosUser)(loggedInUser);
        const payload = {
            sub: serializedUser.id,
            email: serializedUser.email,
            roleId: serializedUser.roleId,
            roleName: serializedUser.userRole?.name ?? null,
        };
        return {
            user: {
                id: serializedUser.id,
                fullName: serializedUser.fullName,
                email: serializedUser.email,
                roleId: serializedUser.roleId,
                roleName: serializedUser.userRole?.name ?? null,
            },
            token: await this.jwtService.signAsync(payload),
        };
    }
    async getInvitation(token) {
        const user = await this.findValidInvitation(token);
        return {
            fullName: user.fullName,
            email: user.email,
            roleName: user.userRole?.name ?? null,
            expiresAt: user.invitationExpiresAt.toISOString(),
        };
    }
    async acceptInvitation(token, dto) {
        const user = await this.findValidInvitation(token);
        const password = await bcrypt.hash(dto.password, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                password,
                isActive: true,
                invitationTokenHash: null,
                invitationSentAt: null,
                invitationExpiresAt: null,
                registrationCompletedAt: new Date(),
            },
        });
        return {
            message: 'Password set successfully. You can now sign in.',
        };
    }
    async findValidInvitation(token) {
        const invitationTokenHash = this.hashInvitationToken(token);
        const user = await this.prisma.user.findUnique({
            where: { invitationTokenHash },
            include: { userRole: true },
        });
        if (!user
            || !user.invitationExpiresAt
            || user.invitationExpiresAt.getTime() <= Date.now()) {
            throw new common_1.GoneException('Password setup link has expired.');
        }
        return user;
    }
    hashInvitationToken(token) {
        return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
    }
};
exports.LosAuthService = LosAuthService;
exports.LosAuthService = LosAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], LosAuthService);

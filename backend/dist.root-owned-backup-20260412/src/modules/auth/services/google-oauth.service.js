"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleOAuthService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const customer_auth_service_1 = require("./customer-auth.service");
let GoogleOAuthService = class GoogleOAuthService {
    customerAuthService;
    constructor(customerAuthService) {
        this.customerAuthService = customerAuthService;
    }
    authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
    tokenEndpoint = 'https://oauth2.googleapis.com/token';
    userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';
    stateTtlMs = 10 * 60 * 1000;
    createAuthorizationUrl(mode = 'register', leadId) {
        const config = this.getConfig();
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.callbackUrl,
            response_type: 'code',
            scope: 'openid email profile',
            prompt: 'select_account',
            state: this.createStateToken(config.stateSecret, mode, leadId)
        });
        return `${this.authorizationEndpoint}?${params.toString()}`;
    }
    async buildSuccessRedirect(code, state) {
        const config = this.getConfig();
        const verifiedState = this.verifyStateToken(state, config.stateSecret);
        const tokens = await this.exchangeCodeForTokens(code, config);
        const profile = await this.fetchUserProfile(tokens.access_token);
        const session = this.createCustomerSession(profile);
        const token = await this.customerAuthService.generateToken({
            uuid: session.customer.customerId,
            mobileNumber: null
        });
        const encodedSession = Buffer.from(JSON.stringify(session)).toString('base64url');
        return {
            redirectUrl: this.buildFrontendRedirect(config.frontendCallbackUrl, {
                mode: verifiedState.mode,
                ...(verifiedState.leadId ? { leadId: verifiedState.leadId } : {})
            }, { session: encodedSession }),
            token
        };
    }
    buildErrorRedirect(message) {
        return this.buildFrontendRedirect(this.getConfig().frontendCallbackUrl, {}, { error: message });
    }
    describeProviderError(error) {
        if (error === 'access_denied') {
            return 'Google login was cancelled.';
        }
        return 'Google login could not be completed.';
    }
    describeCallbackError(error) {
        if (error instanceof common_1.UnauthorizedException) {
            const response = error.getResponse();
            if (typeof response === 'string') {
                return response;
            }
            if (typeof response === 'object' && response !== null && 'message' in response) {
                const message = response.message;
                if (typeof message === 'string') {
                    return message;
                }
            }
        }
        if (error instanceof Error && error.message.trim()) {
            return error.message;
        }
        return 'Google login failed. Please try again.';
    }
    async exchangeCodeForTokens(code, config) {
        const response = await fetch(this.tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: config.callbackUrl,
                grant_type: 'authorization_code'
            })
        });
        const data = (await response.json().catch(() => null));
        if (!response.ok || !data?.access_token) {
            throw new common_1.UnauthorizedException(data?.error_description ?? 'Unable to exchange the Google authorization code.');
        }
        return {
            access_token: data.access_token
        };
    }
    async fetchUserProfile(accessToken) {
        const response = await fetch(this.userInfoEndpoint, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        const data = (await response.json().catch(() => null));
        if (!response.ok) {
            throw new common_1.UnauthorizedException('Unable to load the Google account profile.');
        }
        const email = data?.email?.trim().toLowerCase();
        const subject = data?.sub?.trim();
        const emailVerified = data?.email_verified === true;
        const name = data?.name?.trim();
        if (!subject || !email) {
            throw new common_1.UnauthorizedException('Google did not return a usable account profile.');
        }
        if (!emailVerified) {
            throw new common_1.UnauthorizedException('Your Google account email is not verified.');
        }
        return {
            sub: subject,
            email,
            name: name || undefined
        };
    }
    createCustomerSession(profile) {
        const verifiedAt = new Date().toISOString();
        return {
            customer: {
                id: this.createStableNumericId(profile.sub),
                customerId: `google:${profile.sub}`,
                mobileNumber: null,
                email: profile.email,
                ...(profile.name ? { fullName: profile.name } : {}),
                authProvider: 'google',
                createdAt: verifiedAt
            },
            verifiedAt
        };
    }
    createStableNumericId(value) {
        const digest = (0, node_crypto_1.createHash)('sha256').update(value).digest();
        const numericId = digest.readUInt32BE(0);
        return numericId > 0 ? numericId : 1;
    }
    buildFrontendRedirect(baseUrl, queryParams, hashParams) {
        const url = new URL(baseUrl);
        for (const [key, value] of Object.entries(queryParams)) {
            url.searchParams.set(key, value);
        }
        const hash = new URLSearchParams(hashParams ?? {}).toString();
        return hash ? `${url.toString()}#${hash}` : url.toString();
    }
    createStateToken(secret, mode, leadId) {
        const payload = Buffer.from(JSON.stringify({
            iat: Date.now(),
            mode,
            ...(leadId ? { leadId } : {})
        })).toString('base64url');
        const signature = (0, node_crypto_1.createHmac)('sha256', secret).update(payload).digest('base64url');
        return `${payload}.${signature}`;
    }
    verifyStateToken(state, secret) {
        if (!state) {
            throw new common_1.UnauthorizedException('Missing Google OAuth state.');
        }
        const [payload, signature] = state.split('.');
        if (!payload || !signature) {
            throw new common_1.UnauthorizedException('Invalid Google OAuth state.');
        }
        const expectedSignature = (0, node_crypto_1.createHmac)('sha256', secret).update(payload).digest('base64url');
        const signatureBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);
        if (signatureBuffer.length !== expectedBuffer.length
            || !(0, node_crypto_1.timingSafeEqual)(signatureBuffer, expectedBuffer)) {
            throw new common_1.UnauthorizedException('Invalid Google OAuth state.');
        }
        const parsedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (typeof parsedPayload.iat !== 'number' || !Number.isFinite(parsedPayload.iat)) {
            throw new common_1.UnauthorizedException('Invalid Google OAuth state.');
        }
        if (Date.now() - parsedPayload.iat > this.stateTtlMs) {
            throw new common_1.UnauthorizedException('Google login session expired. Please try again.');
        }
        if (parsedPayload.mode !== 'login' && parsedPayload.mode !== 'register') {
            throw new common_1.UnauthorizedException('Invalid Google OAuth mode.');
        }
        return {
            mode: parsedPayload.mode,
            ...(typeof parsedPayload.leadId === 'string' && parsedPayload.leadId.trim()
                ? { leadId: parsedPayload.leadId.trim() }
                : {})
        };
    }
    getConfig() {
        const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
        const callbackUrl = process.env.GOOGLE_CALLBACK_URL?.trim();
        const frontendCallbackUrl = process.env.GOOGLE_FRONTEND_CALLBACK_URL?.trim() || 'http://localhost:3011/auth/google/callback';
        const stateSecret = process.env.GOOGLE_STATE_SECRET?.trim() || process.env.JWT_SECRET?.trim();
        if (!clientId || !clientSecret || !callbackUrl || !stateSecret) {
            throw new common_1.UnauthorizedException('Google login is not configured yet.');
        }
        return {
            clientId,
            clientSecret,
            callbackUrl,
            frontendCallbackUrl,
            stateSecret
        };
    }
};
exports.GoogleOAuthService = GoogleOAuthService;
exports.GoogleOAuthService = GoogleOAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [customer_auth_service_1.CustomerAuthService])
], GoogleOAuthService);

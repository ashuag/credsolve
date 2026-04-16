import {Injectable} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {CookieOptions, Request, Response} from 'express';
import {CUSTOMER_AUTH_COOKIE_MAX_AGE_MS, CUSTOMER_AUTH_COOKIE_NAME} from '../auth.constants';

export type CustomerJwtPayload = {
    sub: string;
    mobileNumber: string | null;
};

export type CustomerAuthResult =
    | {authenticated: false; reason?: 'invalid_token'}
    | {authenticated: true; customer: CustomerJwtPayload};

type GenerateTokenInput = Omit<CustomerJwtPayload, 'sub'> & { uuid: string };

@Injectable()
export class CustomerAuthService {
    private readonly authCookieOptions: CookieOptions;
    private readonly clearCookieOptions: CookieOptions;

    constructor(private readonly jwtService: JwtService) {
        const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;
        this.clearCookieOptions = {
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            ...(domain ? {domain} : {})
        };
        this.authCookieOptions = {
            ...this.clearCookieOptions,
            maxAge: CUSTOMER_AUTH_COOKIE_MAX_AGE_MS
        };
    }

    async generateToken(customer: GenerateTokenInput): Promise<string> {
        const payload: CustomerJwtPayload = {
            sub: customer.uuid,
            mobileNumber: customer.mobileNumber
        };

        return this.jwtService.signAsync(payload);
    }

    async authenticateRequest(request: Request): Promise<CustomerAuthResult> {
        const token = this.extractToken(request);

        if (!token) {
            return {authenticated: false};
        }

        try {
            const customer = await this.jwtService.verifyAsync<CustomerJwtPayload>(token);
            return {authenticated: true, customer};
        } catch {
            return {authenticated: false, reason: 'invalid_token'};
        }
    }

    setAuthCookie(response: Response, token: string) {
        response.cookie(CUSTOMER_AUTH_COOKIE_NAME, token, this.authCookieOptions);
    }

    clearAuthCookie(response: Response) {
        response.clearCookie(CUSTOMER_AUTH_COOKIE_NAME, this.clearCookieOptions);
    }

    private extractToken(request: Request): string | null {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        if (type === 'Bearer' && token) {
            return token;
        }

        const cookieToken = request.cookies?.[CUSTOMER_AUTH_COOKIE_NAME];
        if (typeof cookieToken === 'string' && cookieToken.trim()) {
            return cookieToken;
        }
        return null;
    }
}

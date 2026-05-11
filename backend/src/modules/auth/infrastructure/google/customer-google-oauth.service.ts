import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { EmailVerificationType } from '@prisma/client';
import { CustomerRepository } from '../repositories/customer.repository';
import { LeadRepository } from '../repositories/lead.repository';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  type GoogleOAuthClientConfig,
} from './google-oauth-http.util';

type GoogleOauthStatePayload = {
  /** Customer uuid (session `sub`). */
  sub: string;
  leadUuid: string | null;
  mode: 'register' | 'login';
  exp: number;
};

function base64UrlEncodeJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function base64UrlDecodeJson<T>(raw: string): T | null {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

@Injectable()
export class CustomerGoogleOauthService {
  constructor(
    private readonly config: ConfigService,
    private readonly customers: CustomerRepository,
    private readonly leads: LeadRepository,
    private readonly prisma: PrismaService
  ) {}

  private stateSecret(): string {
    const s = this.config.get<string>('GOOGLE_STATE_SECRET')?.trim();
    if (!s) {
      throw new InternalServerErrorException('GOOGLE_STATE_SECRET is not configured.');
    }
    return s;
  }

  private googleOAuthConfig(): GoogleOAuthClientConfig {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
    const redirectUri = this.config.get<string>('GOOGLE_CALLBACK_URL')?.trim();
    if (!clientId || !clientSecret || !redirectUri) {
      throw new InternalServerErrorException(
        'Google OAuth is not fully configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL).'
      );
    }
    return { clientId, clientSecret, redirectUri };
  }

  private signState(body: string): string {
    return createHmac('sha256', this.stateSecret()).update(body).digest('base64url');
  }

  serializeState(payload: GoogleOauthStatePayload): string {
    const body = base64UrlEncodeJson(payload);
    const sig = this.signState(body);
    return `${body}.${sig}`;
  }

  parseState(stateParam: string): GoogleOauthStatePayload | null {
    const idx = stateParam.lastIndexOf('.');
    if (idx <= 0) {
      return null;
    }
    const body = stateParam.slice(0, idx);
    const sig = stateParam.slice(idx + 1);
    const expected = this.signState(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
    const parsed = base64UrlDecodeJson<GoogleOauthStatePayload>(body);
    if (!parsed || typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (parsed.exp < Date.now()) {
      return null;
    }
    if (parsed.leadUuid != null && typeof parsed.leadUuid !== 'string') {
      return null;
    }
    if (parsed.mode !== 'register' && parsed.mode !== 'login') {
      return null;
    }
    return parsed;
  }

  buildAuthorizationUrl(req: Request, modeRaw: string | undefined, leadIdRaw: string | undefined): string {
    const session = req.customerSession;
    if (!session) {
      throw new BadRequestException('Session required to start Google email verification.');
    }

    const mode = modeRaw === 'login' ? 'login' : 'register';
    const leadUuid = leadIdRaw?.trim() || null;

    const payload: GoogleOauthStatePayload = {
      sub: session.sub,
      leadUuid,
      mode,
      exp: Date.now() + 10 * 60 * 1000,
    };

    const state = this.serializeState(payload);
    const cfg = this.googleOAuthConfig();
    const scope = ['openid', 'https://www.googleapis.com/auth/userinfo.email'].join(' ');

    return buildGoogleAuthorizationUrl({
      clientId: cfg.clientId,
      redirectUri: cfg.redirectUri,
      state,
      scope,
    });
  }

  /**
   * Completes OAuth, updates lead email when Google confirms the address, returns absolute redirect URL for the customer SPA.
   */
  async completeOAuthRedirect(code: string | undefined, stateParam: string | undefined, googleError: string | undefined): Promise<string> {
    const frontend = this.config.get<string>('GOOGLE_FRONTEND_CALLBACK_URL')?.trim();
    if (!frontend) {
      throw new InternalServerErrorException('GOOGLE_FRONTEND_CALLBACK_URL is not configured.');
    }
    const base = frontend.replace(/\/$/, '');

    const fail = (message: string) => {
      const q = new URLSearchParams({ error: message.slice(0, 280) });
      return `${base}?${q.toString()}`;
    };

    if (googleError) {
      return fail(googleError === 'access_denied' ? 'Google sign-in was cancelled.' : 'Google sign-in failed.');
    }
    if (!code?.trim() || !stateParam?.trim()) {
      return fail('Missing OAuth code or state.');
    }

    const state = this.parseState(stateParam.trim());
    if (!state) {
      return fail('Invalid or expired OAuth state. Try again from the application.');
    }

    const customer = await this.customers.findByUuid(undefined, state.sub);
    if (!customer) {
      return fail('Your session is no longer valid. Sign in again with mobile OTP.');
    }

    const lead = await this.leads.findActiveByCustomerId(customer.id);
    if (!lead) {
      return fail('No active lead for this account.');
    }
    if (state.leadUuid && state.leadUuid !== lead.uuid) {
      return fail('Lead does not match this Google sign-in request.');
    }

    const cfg = this.googleOAuthConfig();
    let accessToken: string;
    try {
      const tokens = await exchangeGoogleAuthorizationCode(cfg, code.trim());
      accessToken = tokens.access_token;
    } catch {
      return fail('Could not exchange Google authorization code.');
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) {
      return fail('Could not load your Google profile.');
    }
    const profile = (await profileRes.json()) as { email?: string; verified_email?: boolean };
    const email = profile.email?.trim().toLowerCase();
    if (!email) {
      return fail('Google did not return an email address.');
    }
    if (!profile.verified_email) {
      return fail('Your Google account email is not verified.');
    }

    await this.prisma.client.$transaction(async (tx) => {
      await this.leads.updateLeadEmailWithVerification(lead.id, email, EmailVerificationType.GOOGLE, tx);
      await this.leads.applyInProgressAfterEmailVerified(lead, tx);
    });

    const ok = new URLSearchParams({
      success: '1',
      mode: state.mode,
      leadId: lead.uuid,
    });
    return `${base}?${ok.toString()}`;
  }
}

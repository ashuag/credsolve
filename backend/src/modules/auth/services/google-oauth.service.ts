import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

type GoogleCustomerSession = {
  customer: {
    id: number;
    customerId: string;
    mobileNumber: null;
    email: string;
    fullName?: string;
    authProvider: 'google';
    createdAt: string;
  };
  verifiedAt: string;
};

type GoogleOAuthMode = 'login' | 'register';

type VerifiedGoogleOAuthState = {
  mode: GoogleOAuthMode;
  leadId?: string;
};

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  frontendCallbackUrl: string;
  stateSecret: string;
};

@Injectable()
export class GoogleOAuthService {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  private readonly authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly tokenEndpoint = 'https://oauth2.googleapis.com/token';
  private readonly userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';
  private readonly stateTtlMs = 10 * 60 * 1000;

  createAuthorizationUrl(mode: GoogleOAuthMode = 'register', leadId?: string) {
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

  async buildSuccessRedirect(code: string, state: string | undefined) {
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
      redirectUrl: this.buildFrontendRedirect(
        config.frontendCallbackUrl,
        {
          mode: verifiedState.mode,
          ...(verifiedState.leadId ? { leadId: verifiedState.leadId } : {})
        },
        { session: encodedSession }
      ),
      token
    };
  }

  buildErrorRedirect(message: string) {
    return this.buildFrontendRedirect(
      this.getConfig().frontendCallbackUrl,
      {},
      { error: message }
    );
  }

  describeProviderError(error: string) {
    if (error === 'access_denied') {
      return 'Google login was cancelled.';
    }

    return 'Google login could not be completed.';
  }

  describeCallbackError(error: unknown) {
    if (error instanceof UnauthorizedException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (typeof response === 'object' && response !== null && 'message' in response) {
        const message = (response as { message?: unknown }).message;

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

  private async exchangeCodeForTokens(code: string, config: GoogleOAuthConfig) {
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

    const data = (await response.json().catch(() => null)) as GoogleTokenResponse | null;

    if (!response.ok || !data?.access_token) {
      throw new UnauthorizedException(data?.error_description ?? 'Unable to exchange the Google authorization code.');
    }

    return {
      access_token: data.access_token
    };
  }

  private async fetchUserProfile(accessToken: string) {
    const response = await fetch(this.userInfoEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = (await response.json().catch(() => null)) as GoogleUserInfoResponse | null;

    if (!response.ok) {
      throw new UnauthorizedException('Unable to load the Google account profile.');
    }

    const email = data?.email?.trim().toLowerCase();
    const subject = data?.sub?.trim();
    const emailVerified = data?.email_verified === true;
    const name = data?.name?.trim();

    if (!subject || !email) {
      throw new UnauthorizedException('Google did not return a usable account profile.');
    }

    if (!emailVerified) {
      throw new UnauthorizedException('Your Google account email is not verified.');
    }

    return {
      sub: subject,
      email,
      name: name || undefined
    };
  }

  private createCustomerSession(profile: { sub: string; email: string; name?: string }): GoogleCustomerSession {
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

  private createStableNumericId(value: string) {
    const digest = createHash('sha256').update(value).digest();
    const numericId = digest.readUInt32BE(0);

    return numericId > 0 ? numericId : 1;
  }

  private buildFrontendRedirect(
    baseUrl: string,
    queryParams: Record<string, string>,
    hashParams?: Record<string, string>
  ) {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
    const hash = new URLSearchParams(hashParams ?? {}).toString();

    return hash ? `${url.toString()}#${hash}` : url.toString();
  }

  private createStateToken(secret: string, mode: GoogleOAuthMode, leadId?: string) {
    const payload = Buffer.from(
      JSON.stringify({
        iat: Date.now(),
        mode,
        ...(leadId ? { leadId } : {})
      })
    ).toString('base64url');
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');

    return `${payload}.${signature}`;
  }

  private verifyStateToken(state: string | undefined, secret: string): VerifiedGoogleOAuthState {
    if (!state) {
      throw new UnauthorizedException('Missing Google OAuth state.');
    }

    const [payload, signature] = state.split('.');

    if (!payload || !signature) {
      throw new UnauthorizedException('Invalid Google OAuth state.');
    }

    const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64url');
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length
      || !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid Google OAuth state.');
    }

    const parsedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      iat?: unknown;
      mode?: unknown;
      leadId?: unknown;
    };

    if (typeof parsedPayload.iat !== 'number' || !Number.isFinite(parsedPayload.iat)) {
      throw new UnauthorizedException('Invalid Google OAuth state.');
    }

    if (Date.now() - parsedPayload.iat > this.stateTtlMs) {
      throw new UnauthorizedException('Google login session expired. Please try again.');
    }

    if (parsedPayload.mode !== 'login' && parsedPayload.mode !== 'register') {
      throw new UnauthorizedException('Invalid Google OAuth mode.');
    }

    return {
      mode: parsedPayload.mode,
      ...(typeof parsedPayload.leadId === 'string' && parsedPayload.leadId.trim()
        ? { leadId: parsedPayload.leadId.trim() }
        : {})
    };
  }

  private getConfig(): GoogleOAuthConfig {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL?.trim();
    const frontendCallbackUrl = process.env.GOOGLE_FRONTEND_CALLBACK_URL?.trim() || 'http://localhost:3011/auth/google/callback';
    const stateSecret = process.env.GOOGLE_STATE_SECRET?.trim() || process.env.JWT_SECRET?.trim();

    if (!clientId || !clientSecret || !callbackUrl || !stateSecret) {
      throw new UnauthorizedException('Google login is not configured yet.');
    }

    return {
      clientId,
      clientSecret,
      callbackUrl,
      frontendCallbackUrl,
      stateSecret
    };
  }
}

/**
 * Google OAuth2 / OpenID without extra npm deps (works with Docker bind mounts + named volumes).
 * @see https://developers.google.com/identity/protocols/oauth2/web-server
 */

export type GoogleOAuthClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function buildGoogleAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
}): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', params.clientId);
  u.searchParams.set('redirect_uri', params.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', params.scope);
  u.searchParams.set('state', params.state);
  u.searchParams.set('access_type', 'offline');
  /** Prefer account picker over forced re-consent (avoids noisy Gmail re-prompts when scope is already granted). */
  u.searchParams.set('prompt', 'select_account');
  u.searchParams.set('include_granted_scopes', 'true');
  return u.toString();
}

export async function exchangeGoogleAuthorizationCode(
  cfg: GoogleOAuthClientConfig,
  code: string
): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`google_token_http_${res.status}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('google_token_no_access_token');
  }
  return { access_token: data.access_token };
}

/**
 * Validates a Google ID token using the tokeninfo endpoint and returns the email.
 * (Lightweight; suitable for NBFC-style flows. Rotate if Google deprecates tokeninfo.)
 */
export async function verifyGoogleIdTokenEmail(
  idToken: string,
  expectedClientId: string
): Promise<{ email: string }> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) {
    throw new Error('google_tokeninfo_failed');
  }
  const data = (await res.json()) as {
    aud?: string;
    azp?: string;
    email?: string;
    email_verified?: string | boolean;
  };
  const audOk =
    data.aud === expectedClientId ||
    (typeof data.aud === 'string' && data.aud.split(',').includes(expectedClientId)) ||
    data.azp === expectedClientId;
  if (!audOk) {
    throw new Error('google_token_wrong_audience');
  }
  const email = data.email?.trim().toLowerCase();
  if (!email) {
    throw new Error('google_token_no_email');
  }
  const verified =
    data.email_verified === true ||
    data.email_verified === 'true' ||
    data.email_verified === 'True';
  if (!verified) {
    throw new Error('google_email_not_verified');
  }
  return { email };
}

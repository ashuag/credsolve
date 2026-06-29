export type AwsSigningCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: string;
};

const IMDS_BASE = 'http://169.254.169.254';
const IMDS_TIMEOUT_MS = 5000;
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Set `AWS_EC2_INSTANCE_ROLE=true` on EC2 (not in local Docker — IMDS is unreachable there). */
export function awsUseEc2InstanceRole(): boolean {
  const raw = (process.env.AWS_EC2_INSTANCE_ROLE ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function hasStaticAwsCredentials(): boolean {
  return Boolean(
    (process.env.AWS_ACCESS_KEY_ID ?? '').trim() && (process.env.AWS_SECRET_ACCESS_KEY ?? '').trim(),
  );
}

type CachedCredentials = {
  creds: AwsSigningCredentials;
  expiresAtMs: number;
};

let cached: CachedCredentials | null = null;

/**
 * AWS signing credentials: env vars first, then EC2/ECS instance IAM role (IMDSv2).
 * On EC2 with MoneyCashEC2Role attached, no AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY needed.
 */
export async function resolveAwsSigningCredentials(): Promise<AwsSigningCredentials> {
  if (hasStaticAwsCredentials()) {
    const sessionToken = (process.env.AWS_SESSION_TOKEN ?? '').trim();
    return {
      accessKeyId: (process.env.AWS_ACCESS_KEY_ID ?? '').trim(),
      secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY ?? '').trim(),
      sessionToken: sessionToken || undefined,
    };
  }

  if (!awsUseEc2InstanceRole()) {
    throw new Error(
      'S3 credentials missing. For local/Docker dev set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY. ' +
        'On EC2 set AWS_EC2_INSTANCE_ROLE=true (MoneyCashEC2Role attached).',
    );
  }

  const now = Date.now();
  if (cached && cached.expiresAtMs - now > REFRESH_BUFFER_MS) {
    return cached.creds;
  }

  const creds = await fetchEc2InstanceRoleCredentials();
  cached = {
    creds,
    expiresAtMs: creds.expiration ? Date.parse(creds.expiration) : now + 60 * 60 * 1000,
  };
  return creds;
}

export function clearAwsCredentialsCache(): void {
  cached = null;
}

async function fetchEc2InstanceRoleCredentials(): Promise<AwsSigningCredentials> {
  const token = await fetchImdsToken();
  const roleName = (await imdsGet('/latest/meta-data/iam/security-credentials/', token)).trim();
  if (!roleName) {
    throw new Error('EC2 instance metadata returned no IAM role name.');
  }

  const raw = await imdsGet(`/latest/meta-data/iam/security-credentials/${encodeURIComponent(roleName)}`, token);
  let parsed: {
    AccessKeyId?: string;
    SecretAccessKey?: string;
    Token?: string;
    Expiration?: string;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error('EC2 instance metadata returned invalid IAM credentials JSON.');
  }

  const accessKeyId = parsed.AccessKeyId?.trim();
  const secretAccessKey = parsed.SecretAccessKey?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(`EC2 IAM role "${roleName}" did not return temporary credentials.`);
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: parsed.Token?.trim() || undefined,
    expiration: parsed.Expiration?.trim() || undefined,
  };
}

async function fetchImdsToken(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMDS_TIMEOUT_MS);
  try {
    const res = await fetch(`${IMDS_BASE}/latest/api/token`, {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`IMDS token request failed (${res.status}).`);
    }
    const token = (await res.text()).trim();
    if (!token) throw new Error('IMDS token response was empty.');
    return token;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const dockerHint =
      message.includes('aborted') || message.includes('fetch failed')
        ? ' Docker containers cannot reach EC2 metadata unless hop limit is 2 and the role is attached to the host.'
        : '';
    throw new Error(
      `Could not load AWS credentials from EC2 instance metadata (${message}).` +
        dockerHint +
        ' Attach MoneyCashEC2Role to the EC2 instance, set AWS_EC2_INSTANCE_ROLE=true, ' +
        'or use AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY for dev.',
    );
  } finally {
    clearTimeout(timer);
  }
}

async function imdsGet(path: string, token: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMDS_TIMEOUT_MS);
  try {
    const res = await fetch(`${IMDS_BASE}${path}`, {
      headers: { 'X-aws-ec2-metadata-token': token },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`IMDS GET ${path} failed (${res.status}).`);
    }
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

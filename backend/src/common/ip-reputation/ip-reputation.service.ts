import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import type { IpReputationVerdict } from './ip-reputation.types';

type ProviderId = 'proxycheck' | 'ipqs';

const CACHE_PREFIX = 'iprep:v1';

/**
 * Classifies a client IP as VPN/proxy/datacenter using a pluggable, env-configurable
 * provider. Designed to be safe by default:
 *  - Disabled unless `VPN_DETECTION_ENABLED` is truthy (no provider call, never blocks).
 *  - Skips private/loopback/reserved IPs (local dev, internal calls).
 *  - Fails OPEN: provider errors/timeouts resolve to `unknown` (never blocks a real user).
 *  - Caches verdicts in Redis so repeated checks across steps cost one GET.
 */
@Injectable()
export class IpReputationService {
  private readonly logger = new Logger(IpReputationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  get enabled(): boolean {
    const raw = (this.config.get<string>('VPN_DETECTION_ENABLED') ?? '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
  }

  async classify(ip: string | undefined): Promise<IpReputationVerdict> {
    if (!this.enabled) {
      return { status: 'unknown', isVpnOrProxy: false, provider: 'disabled' };
    }

    const normalized = (ip ?? '').trim();
    if (!normalized || normalized === 'unknown' || this.isPrivateOrReserved(normalized)) {
      return { status: 'clean', isVpnOrProxy: false, provider: 'skipped', reason: 'private-or-empty' };
    }

    const provider = this.provider();
    const cacheKey = `${CACHE_PREFIX}:${provider}:${normalized}`;

    const cached = await this.readCache(cacheKey);
    if (cached) {
      return cached;
    }

    let verdict: IpReputationVerdict;
    try {
      verdict = await this.queryProvider(provider, normalized);
    } catch (err) {
      this.logger.warn(
        `IP reputation lookup failed for ${normalized} via ${provider}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Fail open. Cache briefly so a provider outage doesn't trigger a request storm.
      const unknown: IpReputationVerdict = {
        status: 'unknown',
        isVpnOrProxy: false,
        provider,
        reason: 'lookup-error',
      };
      await this.writeCache(cacheKey, unknown, 60);
      return unknown;
    }

    // Flagged verdicts expire fast so a user who turns OFF their VPN isn't stuck; clean lasts longer.
    const ttl = verdict.status === 'flagged' ? this.flaggedTtlSec() : this.cleanTtlSec();
    await this.writeCache(cacheKey, verdict, ttl);
    return verdict;
  }

  private provider(): ProviderId {
    const raw = (this.config.get<string>('VPN_DETECTION_PROVIDER') ?? 'proxycheck').trim().toLowerCase();
    return raw === 'ipqs' ? 'ipqs' : 'proxycheck';
  }

  private async queryProvider(provider: ProviderId, ip: string): Promise<IpReputationVerdict> {
    const controller = AbortSignal.timeout(this.timeoutMs());
    if (provider === 'ipqs') {
      return this.queryIpqs(ip, controller);
    }
    return this.queryProxycheck(ip, controller);
  }

  /** proxycheck.io — works with a low-volume keyless tier; set `PROXYCHECK_API_KEY` for higher limits. */
  private async queryProxycheck(ip: string, signal: AbortSignal): Promise<IpReputationVerdict> {
    const key = this.config.get<string>('PROXYCHECK_API_KEY')?.trim();
    const params = new URLSearchParams({ vpn: '1', risk: '1' });
    if (key) {
      params.set('key', key);
    }
    const res = await fetch(`https://proxycheck.io/v2/${encodeURIComponent(ip)}?${params.toString()}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`proxycheck HTTP ${res.status}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    if (json.status !== 'ok') {
      throw new Error(`proxycheck status=${String(json.status)}`);
    }
    const entry = json[ip] as { proxy?: string; type?: string } | undefined;
    const flagged = entry?.proxy === 'yes';
    return {
      status: flagged ? 'flagged' : 'clean',
      isVpnOrProxy: flagged,
      provider: 'proxycheck',
      reason: flagged ? `proxy/${entry?.type ?? 'unknown'}` : undefined,
    };
  }

  /** IPQualityScore — requires `IPQS_API_KEY`. */
  private async queryIpqs(ip: string, signal: AbortSignal): Promise<IpReputationVerdict> {
    const key = this.config.get<string>('IPQS_API_KEY')?.trim();
    if (!key) {
      // No key configured -> can't decide; behave like disabled for this provider.
      return { status: 'unknown', isVpnOrProxy: false, provider: 'ipqs', reason: 'no-api-key' };
    }
    const res = await fetch(
      `https://ipqualityscore.com/api/json/ip/${encodeURIComponent(key)}/${encodeURIComponent(ip)}?strictness=1`,
      { signal, headers: { Accept: 'application/json' } },
    );
    if (!res.ok) {
      throw new Error(`ipqs HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      success?: boolean;
      proxy?: boolean;
      vpn?: boolean;
      tor?: boolean;
      message?: string;
    };
    if (json.success === false) {
      throw new Error(`ipqs ${json.message ?? 'request failed'}`);
    }
    const flagged = Boolean(json.vpn || json.proxy || json.tor);
    return {
      status: flagged ? 'flagged' : 'clean',
      isVpnOrProxy: flagged,
      provider: 'ipqs',
      reason: flagged ? `vpn=${json.vpn} proxy=${json.proxy} tor=${json.tor}` : undefined,
    };
  }

  private async readCache(key: string): Promise<IpReputationVerdict | null> {
    try {
      const raw = await this.redis.client.get(key);
      return raw ? (JSON.parse(raw) as IpReputationVerdict) : null;
    } catch {
      return null;
    }
  }

  private async writeCache(key: string, verdict: IpReputationVerdict, ttlSec: number): Promise<void> {
    try {
      await this.redis.client.set(key, JSON.stringify(verdict), 'EX', ttlSec);
    } catch {
      /* cache is best-effort */
    }
  }

  private timeoutMs(): number {
    return this.parsePositiveInt('VPN_DETECTION_TIMEOUT_MS', 2500);
  }

  private flaggedTtlSec(): number {
    return this.parsePositiveInt('VPN_DETECTION_FLAGGED_TTL_SEC', 300);
  }

  private cleanTtlSec(): number {
    return this.parsePositiveInt('VPN_DETECTION_CLEAN_TTL_SEC', 3600);
  }

  private parsePositiveInt(envKey: string, fallback: number): number {
    const raw = this.config.get<string>(envKey)?.trim();
    if (!raw) {
      return fallback;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  /** RFC1918 / loopback / link-local / unique-local — never sent to an external provider. */
  private isPrivateOrReserved(ip: string): boolean {
    const v = ip.toLowerCase();
    if (v === '::1' || v.startsWith('fe80:') || v.startsWith('fc') || v.startsWith('fd')) {
      return true;
    }
    // IPv4-mapped IPv6 (e.g. ::ffff:10.0.0.1) -> inspect the trailing v4.
    const mapped = v.startsWith('::ffff:') ? v.slice(7) : v;
    const m = mapped.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) {
      return false;
    }
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    return false;
  }
}

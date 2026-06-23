export type IpReputationStatus = 'clean' | 'flagged' | 'unknown';

export interface IpReputationVerdict {
  /** `flagged` => VPN/proxy/datacenter; `clean` => looks like a residential/mobile IP; `unknown` => could not decide (fail-open). */
  status: IpReputationStatus;
  /** Convenience flag the guard reads. Only ever `true` when `status === 'flagged'`. */
  isVpnOrProxy: boolean;
  /** Provider that produced the verdict (or `none`/`skipped` when not evaluated). */
  provider: string;
  /** Short human-readable reason, mainly for logs. */
  reason?: string;
}

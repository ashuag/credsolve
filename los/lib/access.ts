/** Config / admin modules that the Agent role must not see or open. */
export const LOS_AGENT_HIDDEN_NAV_SECTIONS = new Set([
  'Reports',
  'Team',
  'Configuration',
  'Sources & Utm',
  'BRE',
  'Developer Tool',
]);

const LOS_AGENT_RESTRICTED_PATH_PREFIXES = [
  '/reports',
  '/agents',
  '/roles',
  '/masters',
  '/eligibility-criteria',
  '/developer-tools',
] as const;

export function isAgentRole(roleName?: string | null, hierarchyLevel?: number | null): boolean {
  if ((roleName ?? '').trim().toLowerCase() === 'agent') return true;
  return typeof hierarchyLevel === 'number' && hierarchyLevel >= 3;
}

export function canAccessLosConfigModules(
  roleName?: string | null,
  hierarchyLevel?: number | null,
): boolean {
  return !isAgentRole(roleName, hierarchyLevel);
}

export function canMarkInternalTesting(
  roleName?: string | null,
  hierarchyLevel?: number | null,
): boolean {
  return !isAgentRole(roleName, hierarchyLevel);
}

/** Reject / Approve / Disburse on LOS applications — not available to Agent. */
export function canDecideLosApplication(
  roleName?: string | null,
  hierarchyLevel?: number | null,
): boolean {
  return !isAgentRole(roleName, hierarchyLevel);
}

/** Re-enable KYC selfie / bank verification retries — not available to Agent. */
export function canRetryLosApplicationSteps(
  roleName?: string | null,
  hierarchyLevel?: number | null,
): boolean {
  return !isAgentRole(roleName, hierarchyLevel);
}

export function isLosConfigPath(pathname: string): boolean {
  return LOS_AGENT_RESTRICTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

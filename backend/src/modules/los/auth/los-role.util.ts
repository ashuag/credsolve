export function isLosAgentRole(
  roleName?: string | null,
  hierarchyLevel?: number | null,
): boolean {
  if ((roleName ?? '').trim().toLowerCase() === 'agent') return true;
  return typeof hierarchyLevel === 'number' && hierarchyLevel >= 3;
}

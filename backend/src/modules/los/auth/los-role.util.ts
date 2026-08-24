export function isLosAgentRole(
  roleName?: string | null,
  hierarchyLevel?: number | null,
): boolean {
  if ((roleName ?? '').trim().toLowerCase() === 'agent') return true;
  return typeof hierarchyLevel === 'number' && hierarchyLevel >= 3;
}

/** Top-most LOS role (name ADMIN, or hierarchy level 1). */
export function isLosAdminRole(
  roleName?: string | null,
  hierarchyLevel?: number | null,
): boolean {
  if ((roleName ?? '').trim().toUpperCase() === 'ADMIN') return true;
  return hierarchyLevel === 1;
}

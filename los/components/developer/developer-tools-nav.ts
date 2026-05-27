/** Shared links for main sidebar + in-section sub-nav. */
export const DEVELOPER_TOOL_LINKS = [
  { href: '/developer-tools/pre-bre-check', label: 'Pre BRE Check' },
  { href: '/developer-tools/pre-approved-offer', label: 'Pre-approved Offer' },
  { href: '/developer-tools/post-bureau-check', label: 'Post BRE Inspector' },
  { href: '/developer-tools/cibil-report-download', label: 'CIBIL Report Download' },
] as const;

export function isDeveloperToolsPath(pathname: string): boolean {
  return pathname === '/developer-tools' || pathname.startsWith('/developer-tools/');
}

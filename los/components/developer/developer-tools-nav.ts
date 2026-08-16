/** Shared links for main sidebar + in-section sub-nav. */
export const DEVELOPER_TOOL_LINKS = [
  { href: '/developer-tools/pre-bre-check', label: 'Pre BRE Check' },
  { href: '/developer-tools/post-bureau-check', label: 'Post BRE Check' },
  { href: '/developer-tools/post-bre-html', label: 'Post BRE thru HTML' },
  { href: '/developer-tools/cibil-report-download', label: 'Bureau Report Generate' },
  { href: '/developer-tools/cibil-tenacio-fetch', label: 'Tenacio CIBIL Fetch' },
  { href: '/developer-tools/cibil-surepass-fetch', label: 'Surepass CIBIL Fetch' },
  { href: '/developer-tools/post-bre-rules', label: 'Post BRE Rules' },
  { href: '/developer-tools/kyc-face-match-check', label: 'KYC Face Match Check' },
  { href: '/developer-tools/face-liveness-check', label: 'Surepass Face Liveness' },
  { href: '/developer-tools/vendor-api-logs', label: 'Vendor API Logs' },
] as const;

export function isDeveloperToolsPath(pathname: string): boolean {
  return pathname === '/developer-tools' || pathname.startsWith('/developer-tools/');
}

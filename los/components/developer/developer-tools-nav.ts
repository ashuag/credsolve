/** Shared links for main sidebar + in-section sub-nav. */
export const DEVELOPER_TOOL_LINKS = [
  { href: '/developer-tools/pre-bre-check', label: 'Pre BRE Check' },
  { href: '/developer-tools/post-bureau-check', label: 'Post BRE Check' },
  { href: '/developer-tools/post-bre-html', label: 'Post BRE thru HTML' },
  { href: '/developer-tools/cibil-report-download', label: 'Bureau Report Generate' },
  { href: '/developer-tools/cibil-tenacio-fetch', label: 'Tenacio CIBIL Fetch' },
  { href: '/developer-tools/cibil-surepass-fetch', label: 'Surepass CIBIL Fetch' },
  { href: '/developer-tools/nsdl-pan-verification', label: 'NSDL PAN Verification' },
  { href: '/developer-tools/name-match-fuzz-score', label: 'Name Match Fuzzing Score' },
  { href: '/developer-tools/post-bre-rules', label: 'Post BRE Rules' },
  { href: '/developer-tools/kyc-face-match-check', label: 'KYC Face Match Check' },
  { href: '/developer-tools/face-liveness-check', label: 'Surepass Face Liveness' },
  { href: '/developer-tools/tenacio-face-liveness-check', label: 'Tenacio Face Liveness' },
  { href: '/developer-tools/tenacio-face-match-check', label: 'Tenacio Face Match' },
  { href: '/developer-tools/get-payment-status', label: 'Get Payment Status' },
  { href: '/developer-tools/check-disbursement-status', label: 'Check Disbursement Status' },
  { href: '/developer-tools/vendor-api-logs', label: 'Vendor API Logs' },
] as const;

export function isDeveloperToolsPath(pathname: string): boolean {
  return pathname === '/developer-tools' || pathname.startsWith('/developer-tools/');
}

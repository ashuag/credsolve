/**
 * Public surface for the LOS API client. Existing imports of the form
 *   `import { … } from '@/lib/api'`
 * resolve here unchanged. Implementation lives in per-resource files
 * under this folder; the `_shared.ts` module is intentionally NOT
 * re-exported (keep transport plumbing private).
 */
export * from './dashboard';
export * from './partners';
export * from './roles';
export * from './users';
export * from './leads';
export * from './loans';
export * from './customers';
export * from './invitations';
export * from './masters';
export * from './sms-templates';
export * from './vendor-api-configs';
export * from './contact';
export * from './negative-lists';
export * from './bre';
export * from './cibil-report';
export * from './bureau-reports';
export * from './reject-record';
export * from './disbursement';
export * from './kyc-enable-re-kyc';
export * from './cibil-vendor-checks';
export * from './kyc-face-match-check';
export * from './vendor-api-logs';

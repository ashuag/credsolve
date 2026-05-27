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
export * from './invitations';
export * from './masters';
export * from './negative-lists';

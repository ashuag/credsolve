/** Public object base URL (no trailing slash). Prefer `S3_URL`, fall back to `STORAGE_BASE_URL`. */
export function resolveStoragePublicBaseUrl(): string | null {
  const base = (process.env.S3_URL ?? process.env.STORAGE_BASE_URL ?? '').trim().replace(/\/+$/, '');
  return base || null;
}

/** When true, uploads use `public-read` ACL and URLs use `S3_URL` / `STORAGE_BASE_URL` (no presigned links). */
export function objectStorageUsesPublicRead(): boolean {
  const raw = (process.env.S3_PUBLIC_READ ?? process.env.SPACES_PUBLIC_READ ?? '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  return Boolean(resolveStoragePublicBaseUrl());
}

/** @deprecated Use `objectStorageUsesPublicRead`. */
export function spacesUsesPublicRead(): boolean {
  return objectStorageUsesPublicRead();
}

export function resolveObjectStorageAcl(): string | undefined {
  if (!objectStorageUsesPublicRead()) return undefined;
  const acl = (process.env.S3_OBJECT_ACL ?? process.env.SPACES_OBJECT_ACL ?? 'public-read').trim();
  return acl || 'public-read';
}

/** @deprecated Use `resolveObjectStorageAcl`. */
export function resolveSpacesObjectAcl(): string | undefined {
  return resolveObjectStorageAcl();
}

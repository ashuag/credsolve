/** When true, uploads use `public-read` ACL and URLs use `STORAGE_BASE_URL` (no presigned links). */
export function spacesUsesPublicRead(): boolean {
  const raw = (process.env.SPACES_PUBLIC_READ ?? '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  return Boolean((process.env.STORAGE_BASE_URL ?? '').trim());
}

export function resolveSpacesObjectAcl(): string | undefined {
  if (!spacesUsesPublicRead()) return undefined;
  const acl = (process.env.SPACES_OBJECT_ACL ?? 'public-read').trim();
  return acl || 'public-read';
}

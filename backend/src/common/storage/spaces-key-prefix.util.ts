/**
 * Folder prefix inside a shared bucket (`…/local/…`, `…/staging/…`, `…/prod/…`).
 * DB paths stay `customer/{uuid}/…`; the prefix is applied only when talking to object storage.
 */
export function resolveStorageKeyPrefix(): string {
  const explicit = (process.env.S3_KEY_PREFIX ?? process.env.SPACES_KEY_PREFIX ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (explicit) return explicit;

  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'prod') return 'prod';
  if (nodeEnv === 'staging') return 'staging';
  return 'local';
}

/** @deprecated Use `resolveStorageKeyPrefix`. */
export function resolveSpacesKeyPrefix(): string {
  return resolveStorageKeyPrefix();
}

export function toPrefixedObjectKey(relativePath: string, prefix: string): string {
  const rel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.includes('..')) {
    throw new Error('Invalid object key.');
  }
  const p = prefix.replace(/^\/+|\/+$/g, '');
  return p ? `${p}/${rel}` : rel;
}

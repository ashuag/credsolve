import type { KycFilesService } from './kyc-files.service';

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Reads a stored liveness video object key from persisted vendor / pipeline JSON. */
export function extractLivenessVideoPathFromVendorJson(vendor: unknown): string | null {
  if (!vendor || typeof vendor !== 'object') return null;
  const root = vendor as Record<string, unknown>;

  const activePath = readTrimmedString(
    root.activeLiveness && typeof root.activeLiveness === 'object'
      ? (root.activeLiveness as Record<string, unknown>).videoPath
      : null,
  );
  if (activePath) return activePath;

  const pipelineSteps = root.pipelineSteps;
  if (!Array.isArray(pipelineSteps)) return null;

  for (let i = pipelineSteps.length - 1; i >= 0; i -= 1) {
    const step = pipelineSteps[i];
    if (!step || typeof step !== 'object') continue;
    const response = (step as Record<string, unknown>).response;
    if (!response || typeof response !== 'object') continue;
    const path = readTrimmedString((response as Record<string, unknown>).livenessVideoPath);
    if (path) return path;
  }

  return null;
}

export async function resolveLivenessVideoRelativePath(params: {
  columnPath: string | null | undefined;
  vendorJson: unknown;
  customerUuid: string;
  applicationUuid: string;
  kycFiles: KycFilesService;
}): Promise<string | null> {
  const candidates = new Set<string>();
  const column = params.columnPath?.trim();
  if (column) candidates.add(column);

  const fromVendor = extractLivenessVideoPathFromVendorJson(params.vendorJson);
  if (fromVendor) candidates.add(fromVendor);

  for (const ext of ['webm', 'mp4'] as const) {
    candidates.add(
      params.kycFiles.livenessVideoRelativePath(
        params.customerUuid,
        params.applicationUuid,
        ext,
      ),
    );
  }

  for (const candidate of candidates) {
    try {
      if (await params.kycFiles.exists(candidate)) return candidate;
    } catch {
      /* storage probe failed — try next candidate */
    }
  }

  return column ?? fromVendor ?? null;
}

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

export async function fetchJpegBufferFromUrl(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    if (contentType && !contentType.includes('jpeg') && !contentType.includes('jpg')) {
      throw new Error(`Expected JPEG content-type, got ${contentType || 'unknown'}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) {
      throw new Error('Image is empty.');
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new Error('Image must be 6MB or smaller.');
    }
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

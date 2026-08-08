export type HeadMovementRecordingFailureReason = 'unsupported' | 'no-frames' | 'failed';

export type HeadMovementRecording = {
  /** The clip itself, kept as the audit artifact. */
  videoFile: File;
  /** JPEG stills sampled from the same stream; the server scores head pose on these. */
  frameFiles: File[];
};

export type RecordHeadMovementResult =
  | { ok: true; recording: HeadMovementRecording }
  | { ok: false; reason: HeadMovementRecordingFailureReason };

export type RecordHeadMovementOptions = {
  stream: MediaStream;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  durationMs?: number;
  frameCount?: number;
  /** Fires on each sampled frame so the UI can show a countdown. */
  onProgress?: (elapsedMs: number, durationMs: number) => void;
};

const DEFAULT_DURATION_MS = 5_000;
const DEFAULT_FRAME_COUNT = 12;
/** Wide enough for face-api landmarks, small enough to upload a dozen of them. */
const FRAME_MAX_WIDTH = 480;

const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
];

export function headMovementRecordingErrorMessage(reason: HeadMovementRecordingFailureReason): string {
  switch (reason) {
    case 'unsupported':
      return 'This browser cannot record video. Try the latest Chrome or Safari on your phone.';
    case 'no-frames':
      return 'We could not read any frames from the camera. Check the camera and try again.';
    default:
      return 'The head-movement recording did not complete. Please try again.';
  }
}

function pickVideoMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const mime of VIDEO_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

export function isHeadMovementRecordingSupported(): boolean {
  return pickVideoMimeType() !== null;
}

function fileExtensionFor(mimeType: string): 'webm' | 'mp4' {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  index: number,
): Promise<File | null> {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return Promise.resolve(null);

  const scale = Math.min(1, FRAME_MAX_WIDTH / sourceWidth);
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(
          blob ? new File([blob], `frame-${String(index).padStart(2, '0')}.jpg`, { type: 'image/jpeg' }) : null,
        );
      },
      'image/jpeg',
      0.82,
    );
  });
}

/**
 * Records a short clip while the customer moves their head, sampling stills along the way.
 *
 * Scoring happens on the server: the browser only supplies the raw evidence, since a client
 * that reports its own liveness result could simply be told to report a pass.
 */
export async function recordHeadMovement(
  options: RecordHeadMovementOptions,
): Promise<RecordHeadMovementResult> {
  const { stream, video, canvas } = options;
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  const frameCount = options.frameCount ?? DEFAULT_FRAME_COUNT;

  const mimeType = pickVideoMimeType();
  if (!mimeType) {
    return { ok: false, reason: 'unsupported' };
  }

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType });
  } catch {
    return { ok: false, reason: 'unsupported' };
  }

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => resolve();
  });

  const frameFiles: File[] = [];
  const intervalMs = Math.max(120, Math.floor(durationMs / frameCount));

  try {
    recorder.start();

    for (let i = 0; i < frameCount; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const frame = await captureFrame(video, canvas, i);
      if (frame) frameFiles.push(frame);
      options.onProgress?.(Math.min(durationMs, (i + 1) * intervalMs), durationMs);
    }
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
  }

  await stopped;

  if (!frameFiles.length) {
    return { ok: false, reason: 'no-frames' };
  }

  const blob = new Blob(chunks, { type: mimeType });
  if (!blob.size) {
    return { ok: false, reason: 'failed' };
  }

  return {
    ok: true,
    recording: {
      videoFile: new File([blob], `head-movement.${fileExtensionFor(mimeType)}`, { type: mimeType }),
      frameFiles,
    },
  };
}

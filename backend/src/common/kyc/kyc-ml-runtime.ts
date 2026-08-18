import { Logger } from '@nestjs/common';

const logger = new Logger('KycMlRuntime');

export type TfNode = typeof import('@tensorflow/tfjs-node');
export type FaceApi = typeof import('@vladmandic/face-api');

let tfModule: TfNode | null = null;
let faceApiModule: FaceApi | null = null;
let loadError: Error | null = null;
let loaded = false;

/**
 * Loads the tfjs-node native addon on first use instead of at process boot.
 * The addon initializes TensorFlow's own native CPU thread pool, which
 * otherwise spikes CPU on every container start (deploys, restarts) even
 * when no KYC request ever arrives.
 */
function ensureRuntimeLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    // Native addon. Fails on linux/arm64 Docker (Apple Silicon) because tfjs-node
    // publishes linux-x64 bindings. `@vladmandic/face-api` (Node entry) also requires it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    tfModule = require('@tensorflow/tfjs-node') as TfNode;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    faceApiModule = require('@vladmandic/face-api') as FaceApi;
    logger.log(
      'KYC ML runtime ready (@tensorflow/tfjs-node + @vladmandic/face-api). ' +
        `arch=${process.arch} platform=${process.platform}`,
    );
  } catch (err) {
    loadError = err instanceof Error ? err : new Error(String(err));
    logger.warn(
      `@tensorflow/tfjs-node failed to load (${loadError.message}). ` +
        'KYC face match and selfie validation are unavailable until native bindings match this CPU. ' +
        'Compose runs the backend as linux/amd64 for tfjs-node; after changing platform, wipe ' +
        '`backend/node_modules` and recreate the backend service. Auth/OTP still work.',
    );
  }
}

export function isKycMlAvailable(): boolean {
  ensureRuntimeLoaded();
  return tfModule != null && faceApiModule != null;
}

export function getKycMlLoadError(): Error | null {
  ensureRuntimeLoaded();
  return loadError;
}

export function getTfNode(): TfNode {
  ensureRuntimeLoaded();
  if (!tfModule) {
    throw loadError ?? new Error('@tensorflow/tfjs-node is not available');
  }
  return tfModule;
}

export function getFaceApi(): FaceApi {
  ensureRuntimeLoaded();
  if (!faceApiModule) {
    throw loadError ?? new Error('@vladmandic/face-api is not available');
  }
  return faceApiModule;
}

export function isNonProductionNodeEnv(): boolean {
  const env = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  return env !== 'production' && env !== 'prod';
}

import type * as tf from '@tensorflow/tfjs-node';
import type { SelfieFaceBox } from './kyc-selfie-face-validation.util';

/** Downscaled face-crop width used for blur measurement (resolution-normalized). */
export const KYC_SELFIE_BLUR_FACE_CROP_MAX_WIDTH = 200;

/**
 * Minimum Laplacian variance on the face crop. Values below this are treated as too blurry.
 * Tuned on downscaled (~200px) grayscale face regions from phone selfies.
 */
export const KYC_SELFIE_MIN_LAPLACIAN_VARIANCE = 55;

export type SelfieFaceBlurMeasurement = {
  laplacianVariance: number;
  minLaplacianVarianceRequired: number;
  passed: boolean;
};

export function validateSelfieFaceBlur(
  laplacianVariance: number,
  minVariance: number = KYC_SELFIE_MIN_LAPLACIAN_VARIANCE,
): { ok: true } | { ok: false; reason: string } {
  if (!Number.isFinite(laplacianVariance) || laplacianVariance < minVariance) {
    return {
      ok: false,
      reason:
        'Selfie is too blurry. Hold your phone steady, use good lighting, and try again.',
    };
  }
  return { ok: true };
}

/** Variance of the 3×3 Laplacian response on grayscale pixels (higher = sharper). */
export function computeLaplacianVariance(
  gray: ArrayLike<number>,
  width: number,
  height: number,
): number {
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const lap =
        gray[idx - width]! +
        gray[idx - 1]! -
        4 * gray[idx]! +
        gray[idx + 1]! +
        gray[idx + width]!;
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/** Grayscale face crop used by blur + lighting gates (resolution-normalized). */
export function extractGrayFaceCrop(
  tensor: tf.Tensor3D,
  box: SelfieFaceBox,
  imageWidth: number,
  imageHeight: number,
  targetMaxWidth: number = KYC_SELFIE_BLUR_FACE_CROP_MAX_WIDTH,
): { pixels: Uint8Array; width: number; height: number } {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(imageWidth, Math.ceil(box.x + box.width));
  const y1 = Math.min(imageHeight, Math.ceil(box.y + box.height));
  const cropW = Math.max(1, x1 - x0);
  const cropH = Math.max(1, y1 - y0);

  const scale = cropW > targetMaxWidth ? targetMaxWidth / cropW : 1;
  const outW = Math.max(3, Math.round(cropW * scale));
  const outH = Math.max(3, Math.round(cropH * scale));

  const rgb = tensor.dataSync();
  const gray = new Uint8Array(outW * outH);

  for (let oy = 0; oy < outH; oy += 1) {
    for (let ox = 0; ox < outW; ox += 1) {
      const sx = x0 + Math.floor((ox / outW) * cropW);
      const sy = y0 + Math.floor((oy / outH) * cropH);
      const idx = (sy * imageWidth + sx) * 3;
      const r = rgb[idx] ?? 0;
      const g = rgb[idx + 1] ?? 0;
      const b = rgb[idx + 2] ?? 0;
      gray[oy * outW + ox] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
  }

  return { pixels: gray, width: outW, height: outH };
}

export function measureSelfieFaceBlur(
  tensor: tf.Tensor3D,
  box: SelfieFaceBox,
  minVariance: number = KYC_SELFIE_MIN_LAPLACIAN_VARIANCE,
): SelfieFaceBlurMeasurement {
  const [imageHeight, imageWidth] = tensor.shape;
  const crop = extractGrayFaceCrop(tensor, box, imageWidth, imageHeight);
  const laplacianVariance = computeLaplacianVariance(crop.pixels, crop.width, crop.height);
  return {
    laplacianVariance,
    minLaplacianVarianceRequired: minVariance,
    passed: Number.isFinite(laplacianVariance) && laplacianVariance >= minVariance,
  };
}

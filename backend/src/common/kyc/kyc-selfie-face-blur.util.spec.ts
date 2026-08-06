import {
  computeLaplacianVariance,
  validateSelfieFaceBlur,
  KYC_SELFIE_MIN_LAPLACIAN_VARIANCE,
} from './kyc-selfie-face-blur.util';

function fillGray(width: number, height: number, value: number): Uint8Array {
  const pixels = new Uint8Array(width * height);
  pixels.fill(value);
  return pixels;
}

function checkerboardGray(width: number, height: number, cell = 4): Uint8Array {
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      pixels[y * width + x] = on ? 255 : 0;
    }
  }
  return pixels;
}

describe('computeLaplacianVariance', () => {
  it('returns ~0 for a uniform gray image', () => {
    const gray = fillGray(64, 64, 128);
    expect(computeLaplacianVariance(gray, 64, 64)).toBeLessThan(1);
  });

  it('returns a high variance for a sharp checkerboard', () => {
    const gray = checkerboardGray(64, 64, 2);
    expect(computeLaplacianVariance(gray, 64, 64)).toBeGreaterThan(500);
  });
});

describe('validateSelfieFaceBlur', () => {
  it('rejects low variance as blurry', () => {
    const result = validateSelfieFaceBlur(12);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/blurry/i);
    }
  });

  it('accepts variance above the threshold', () => {
    const result = validateSelfieFaceBlur(KYC_SELFIE_MIN_LAPLACIAN_VARIANCE + 10);
    expect(result).toEqual({ ok: true });
  });
});

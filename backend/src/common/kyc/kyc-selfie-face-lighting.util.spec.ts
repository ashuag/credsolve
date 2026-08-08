import {
  computeFaceLightingStats,
  validateSelfieFaceLighting,
  KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE,
  KYC_SELFIE_MAX_DARK_PIXEL_RATIO,
  KYC_SELFIE_DARK_PIXEL_THRESHOLD,
} from './kyc-selfie-face-lighting.util';

function fillGray(n: number, value: number): Uint8Array {
  const pixels = new Uint8Array(n);
  pixels.fill(value);
  return pixels;
}

/** Approximate deep-skin midtones with brighter cheek/forehead patches. */
function darkSkinWellLitCrop(): Uint8Array {
  const pixels = new Uint8Array(1000);
  for (let i = 0; i < pixels.length; i += 1) {
    // Mostly midtones ~38–52 (would have failed the old dark-pixel threshold of 48),
    // with ~20% highlight patches ~90.
    pixels[i] = i % 5 === 0 ? 92 : 42;
  }
  return pixels;
}

describe('computeFaceLightingStats', () => {
  it('reports low mean and high underexposed ratio for a crushed-black crop', () => {
    const stats = computeFaceLightingStats(fillGray(1000, 8));
    expect(stats.meanFaceLuminance).toBe(8);
    expect(stats.darkPixelRatio).toBe(1);
    expect(stats.luminanceStd).toBe(0);
    expect(stats.highlightP90).toBe(8);
  });

  it('reports bright mean and low underexposed ratio for a lit crop', () => {
    const stats = computeFaceLightingStats(fillGray(1000, 140));
    expect(stats.meanFaceLuminance).toBe(140);
    expect(stats.darkPixelRatio).toBe(0);
    expect(stats.highlightP90).toBe(140);
  });

  it('does not treat deep-skin midtones as underexposed crushed blacks', () => {
    const stats = computeFaceLightingStats(darkSkinWellLitCrop());
    expect(stats.meanFaceLuminance).toBeGreaterThan(40);
    expect(stats.meanFaceLuminance).toBeLessThan(55);
    expect(stats.darkPixelRatio).toBeLessThan(0.05);
    expect(stats.highlightP90).toBeGreaterThanOrEqual(90);
    // Old gate used threshold 48 — most midtones would have counted as dark.
    const oldDarkRatio =
      Array.from(darkSkinWellLitCrop()).filter((v) => v < 48).length / 1000;
    expect(oldDarkRatio).toBeGreaterThan(0.5);
    expect(KYC_SELFIE_DARK_PIXEL_THRESHOLD).toBeLessThan(48);
  });
});

describe('validateSelfieFaceLighting', () => {
  it('rejects a crushed-black / too-dark face', () => {
    const result = validateSelfieFaceLighting(18, 0.8, undefined, undefined, 4, 22);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/too dark/i);
    }
  });

  it('accepts a well-lit face', () => {
    const result = validateSelfieFaceLighting(
      KYC_SELFIE_MIN_MEAN_FACE_LUMINANCE + 10,
      KYC_SELFIE_MAX_DARK_PIXEL_RATIO - 0.1,
      undefined,
      undefined,
      20,
      120,
    );
    expect(result).toEqual({ ok: true });
  });

  it('accepts deep skin tones with lower mean when highlights/contrast are present', () => {
    const stats = computeFaceLightingStats(darkSkinWellLitCrop());
    const result = validateSelfieFaceLighting(
      stats.meanFaceLuminance,
      stats.darkPixelRatio,
      undefined,
      undefined,
      stats.luminanceStd,
      stats.highlightP90,
    );
    expect(result).toEqual({ ok: true });
  });

  it('rejects low mean with no contrast or highlights (true underexposure)', () => {
    const result = validateSelfieFaceLighting(24, 0.2, undefined, undefined, 3, 28);
    expect(result.ok).toBe(false);
  });
});

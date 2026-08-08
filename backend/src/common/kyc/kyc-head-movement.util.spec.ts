import {
  computeHeadPoseSample,
  scoreHeadMovement,
  KYC_HEAD_MOVEMENT_MIN_SCORE,
} from './kyc-head-movement.util';

/**
 * Landmarks for a synthetic face. `yaw` and `pitch` are expressed in interocular units so a
 * pose can be reproduced at any face size.
 */
function landmarksFor(yaw: number, pitch: number, interocular = 40) {
  const leftEye = { x: 100, y: 100 };
  const rightEye = { x: 100 + interocular, y: 100 };
  const eyeMidX = 100 + interocular / 2;
  return {
    leftEye,
    rightEye,
    noseTip: { x: eyeMidX + yaw * interocular, y: 100 + pitch * interocular },
    mouthCenter: { x: eyeMidX, y: 100 + interocular },
  };
}

function posesFor(samples: Array<{ yaw: number; pitch: number; interocular?: number }>) {
  return samples.map((s) => computeHeadPoseSample(landmarksFor(s.yaw, s.pitch, s.interocular)));
}

describe('computeHeadPoseSample', () => {
  it('is independent of face size', () => {
    const near = computeHeadPoseSample(landmarksFor(0.2, 0.6, 40))!;
    const far = computeHeadPoseSample(landmarksFor(0.2, 0.6, 80))!;
    expect(near.yaw).toBeCloseTo(far.yaw, 6);
    expect(near.pitch).toBeCloseTo(far.pitch, 6);
  });

  it('returns null when the eyes are too close to measure', () => {
    expect(computeHeadPoseSample(landmarksFor(0, 0.6, 4))).toBeNull();
  });
});

describe('scoreHeadMovement', () => {
  it('fails a held-still photo', () => {
    const poses = posesFor(Array.from({ length: 10 }, () => ({ yaw: 0.05, pitch: 0.6 })));
    const result = scoreHeadMovement({ poses, framesAnalyzed: poses.length });

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.directions).toEqual([]);
  });

  it('passes a left-right head turn and names both directions', () => {
    const poses = posesFor(
      [-0.2, -0.1, 0, 0.1, 0.2, 0.1, 0, -0.1].map((yaw) => ({ yaw, pitch: 0.6 })),
    );
    const result = scoreHeadMovement({ poses, framesAnalyzed: poses.length });

    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(KYC_HEAD_MOVEMENT_MIN_SCORE);
    expect(result.yawRange).toBeCloseTo(0.4, 6);
    expect(result.directions).toContain('left');
    expect(result.directions).toContain('right');
  });

  it('passes a nod — movement in any direction counts', () => {
    const poses = posesFor(
      [0.55, 0.6, 0.65, 0.7, 0.75, 0.7, 0.65].map((pitch) => ({ yaw: 0.02, pitch })),
    );
    const result = scoreHeadMovement({ poses, framesAnalyzed: poses.length });

    expect(result.passed).toBe(true);
    expect(result.directions).toContain('up');
    expect(result.directions).toContain('down');
    expect(result.directions).not.toContain('left');
  });

  it('does not read movement into a face that simply moved closer to the camera', () => {
    const poses = posesFor(
      [40, 50, 60, 70, 80, 90].map((interocular) => ({ yaw: 0.2, pitch: 0.6, interocular })),
    );
    const result = scoreHeadMovement({ poses, framesAnalyzed: poses.length });

    expect(result.passed).toBe(false);
    expect(result.yawRange).toBeCloseTo(0, 6);
  });

  it('fails when too few frames contained a face', () => {
    const poses = posesFor([-0.2, 0.2, -0.2].map((yaw) => ({ yaw, pitch: 0.6 })));
    const result = scoreHeadMovement({ poses, framesAnalyzed: 12 });

    expect(result.passed).toBe(false);
    expect(result.framesWithFace).toBe(3);
    expect(result.reason).toMatch(/could not see your face/i);
  });

  it('fails when the face dropped out of most frames', () => {
    const poses = posesFor([-0.2, -0.1, 0.1, 0.2, -0.2].map((yaw) => ({ yaw, pitch: 0.6 })));
    const result = scoreHeadMovement({ poses: [...poses, null, null, null, null, null, null], framesAnalyzed: 11 });

    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/left the frame/i);
  });
});

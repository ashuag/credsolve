import type { LosApplicationDetails, LosMoneyCashFaceMatch } from '@/lib/api';
import {
  formatActiveLivenessOnlySummary,
  formatExpressionAntiSpoofSummary,
  formatMoneyCashFaceMatchSummary,
  formatSelfieFaceValidationSummary,
  formatConfidencePercent,
  formatDistance,
  formatLaplacianVariance,
} from '@/lib/kyc-selfie-validation-display';

export type KycPipelineStepId =
  | 'selfie-quality'
  | 'active-liveness'
  | 'expression-anti-spoof'
  | 'aadhaar-face-match';

export type KycPipelineStepTone = 'ok' | 'warn' | 'pending' | 'neutral';

export type KycPipelineStepView = {
  id: KycPipelineStepId;
  stepNumber: number;
  label: string;
  summary: string;
  sub?: string;
  tone: KycPipelineStepTone;
};

export const KYC_FACE_PIPELINE_STEP_LABELS = [
  'Selfie quality (MoneyCash)',
  'Aadhaar face match (MoneyCash)',
  'Expression anti-spoof',
  'Active liveness (MoneyCash)',
] as const;

/** Display order matches backend execution: selfie → face match → expression → active liveness. */
export const KYC_FACE_PIPELINE_DISPLAY_ORDER: KycPipelineStepId[] = [
  'selfie-quality',
  'aadhaar-face-match',
  'expression-anti-spoof',
  'active-liveness',
];

export function faceMatchPipelinePhase(
  match: LosMoneyCashFaceMatch | null | undefined,
): 'none' | 'pending' | 'skipped' | 'ran' {
  if (!match) return 'none';
  const reason = match.reason?.trim() ?? '';
  if (reason.startsWith('Pending')) return 'pending';
  if (reason.startsWith('Skipped')) return 'skipped';
  if (match.checkedAt || match.matchScore != null || match.passed) return 'ran';
  return 'none';
}

function selfieStep(row: LosApplicationDetails): KycPipelineStepView {
  const v = row.selfieFaceValidation;
  const summary = formatSelfieFaceValidationSummary(row);
  let tone: KycPipelineStepTone = 'neutral';
  if (v?.checkedAt) tone = v.passed ? 'ok' : 'warn';

  let sub: string | undefined;
  if (v?.reason && !v.passed) {
    sub = v.reason;
  } else if (v?.confidenceBreakdown) {
    sub = `Detection ${formatConfidencePercent(v.confidenceBreakdown.detection)} · alignment ${formatConfidencePercent(v.confidenceBreakdown.landmarkAlignment)}${
      v.laplacianVariance != null
        ? ` · Laplacian ${formatLaplacianVariance(v.laplacianVariance)} (min ${formatLaplacianVariance(v.minLaplacianVarianceRequired)})`
        : ''
    }`;
  }

  return {
    id: 'selfie-quality',
    stepNumber: 1,
    label: KYC_FACE_PIPELINE_STEP_LABELS[0],
    summary,
    sub,
    tone,
  };
}

function activeLivenessStep(row: LosApplicationDetails): KycPipelineStepView {
  const selfie = row.selfieFaceValidation;
  const liveness = row.livenessSummary;
  const faceMatchPhase = faceMatchPipelinePhase(row.moneyCashFaceMatch);

  if (selfie?.checkedAt && !selfie.passed) {
    return {
      id: 'active-liveness',
      stepNumber: 4,
      label: KYC_FACE_PIPELINE_STEP_LABELS[3],
      summary: 'Skipped · selfie quality did not pass',
      tone: 'neutral',
    };
  }

  if (faceMatchPhase === 'pending' || faceMatchPhase === 'none') {
    return {
      id: 'active-liveness',
      stepNumber: 4,
      label: KYC_FACE_PIPELINE_STEP_LABELS[3],
      summary: 'Pending · runs after Aadhaar face match',
      tone: 'pending',
    };
  }

  if (faceMatchPhase === 'skipped' || (faceMatchPhase === 'ran' && !row.moneyCashFaceMatch?.passed)) {
    return {
      id: 'active-liveness',
      stepNumber: 4,
      label: KYC_FACE_PIPELINE_STEP_LABELS[3],
      summary: 'Skipped · Aadhaar face match did not pass',
      tone: 'neutral',
    };
  }

  if (liveness?.checkedAt && liveness.expressionAntiSpoofPassed === false) {
    return {
      id: 'active-liveness',
      stepNumber: 4,
      label: KYC_FACE_PIPELINE_STEP_LABELS[3],
      summary: 'Skipped · expression anti-spoof did not pass',
      tone: 'neutral',
    };
  }

  if (!liveness?.checkedAt) {
    return {
      id: 'active-liveness',
      stepNumber: 4,
      label: KYC_FACE_PIPELINE_STEP_LABELS[3],
      summary: 'Pending · runs after expression anti-spoof',
      tone: 'pending',
    };
  }

  const summary = formatActiveLivenessOnlySummary(row);
  let tone: KycPipelineStepTone = 'neutral';
  if (liveness?.checkedAt) {
    const passed = liveness.activeLivenessPassed ?? row.livenessPassed;
    tone = passed ? 'ok' : 'warn';
  }

  let sub: string | undefined;
  if (liveness?.activeLivenessReason && !liveness.activeLivenessPassed) {
    sub = liveness.activeLivenessReason;
  } else if (liveness?.framesAnalyzed != null) {
    sub = `${liveness.framesWithFace ?? 0}/${liveness.framesAnalyzed} frames with face`;
  }

  return {
    id: 'active-liveness',
    stepNumber: 4,
    label: KYC_FACE_PIPELINE_STEP_LABELS[3],
    summary,
    sub,
    tone,
  };
}

function expressionStep(row: LosApplicationDetails): KycPipelineStepView {
  const liveness = row.livenessSummary;
  const selfie = row.selfieFaceValidation;
  const faceMatchPhase = faceMatchPipelinePhase(row.moneyCashFaceMatch);

  if (selfie?.checkedAt && !selfie.passed) {
    return {
      id: 'expression-anti-spoof',
      stepNumber: 3,
      label: KYC_FACE_PIPELINE_STEP_LABELS[2],
      summary: 'Skipped · selfie quality did not pass',
      tone: 'neutral',
    };
  }

  if (faceMatchPhase === 'pending' || faceMatchPhase === 'none') {
    return {
      id: 'expression-anti-spoof',
      stepNumber: 3,
      label: KYC_FACE_PIPELINE_STEP_LABELS[2],
      summary: 'Pending · runs after Aadhaar face match',
      tone: 'pending',
    };
  }

  if (faceMatchPhase === 'skipped' || (faceMatchPhase === 'ran' && !row.moneyCashFaceMatch?.passed)) {
    return {
      id: 'expression-anti-spoof',
      stepNumber: 3,
      label: KYC_FACE_PIPELINE_STEP_LABELS[2],
      summary: 'Skipped · Aadhaar face match did not pass',
      tone: 'neutral',
    };
  }

  if (!liveness?.checkedAt) {
    return {
      id: 'expression-anti-spoof',
      stepNumber: 3,
      label: KYC_FACE_PIPELINE_STEP_LABELS[2],
      summary: 'Not run',
      tone: 'neutral',
    };
  }

  const summary = formatExpressionAntiSpoofSummary(row);
  let tone: KycPipelineStepTone = 'neutral';
  if (liveness.expressionAntiSpoofPassed === true) tone = 'ok';
  else if (liveness.expressionAntiSpoofPassed === false) tone = 'warn';

  const sub =
    liveness.expressionAntiSpoofReason && liveness.expressionAntiSpoofPassed === false
      ? liveness.expressionAntiSpoofReason
      : undefined;

  return {
    id: 'expression-anti-spoof',
    stepNumber: 3,
    label: KYC_FACE_PIPELINE_STEP_LABELS[2],
    summary,
    sub,
    tone,
  };
}

function faceMatchStep(row: LosApplicationDetails): KycPipelineStepView {
  const phase = faceMatchPipelinePhase(row.moneyCashFaceMatch);
  const summary = formatMoneyCashFaceMatchSummary(row);
  let tone: KycPipelineStepTone = 'neutral';

  if (phase === 'pending') tone = 'pending';
  else if (row.moneyCashFaceMatch?.passed) tone = 'ok';
  else if (phase === 'ran' && !row.moneyCashFaceMatch?.passed) tone = 'warn';
  else if (phase === 'skipped') tone = 'neutral';

  let sub: string | undefined;
  const m = row.moneyCashFaceMatch;
  if (m?.reason && !m.passed && phase === 'ran') {
    sub = m.reason;
  } else if (m?.distance != null && phase === 'ran') {
    sub = `Distance ${formatDistance(m.distance)} (max ${formatDistance(m.maxDistanceThreshold)})`;
  } else if (phase === 'pending') {
    sub = 'Runs after selfie quality passes';
  } else if (phase === 'skipped' && m?.reason) {
    sub = m.reason.replace(/^Skipped —?\s*/i, '');
  } else if (m?.matchScore != null && phase === 'ran') {
    sub = `Score ${formatConfidencePercent(m.matchScore)}`;
  }

  return {
    id: 'aadhaar-face-match',
    stepNumber: 2,
    label: KYC_FACE_PIPELINE_STEP_LABELS[1],
    summary,
    sub,
    tone,
  };
}

const KYC_PIPELINE_STEP_BUILDERS: Record<
  KycPipelineStepId,
  (row: LosApplicationDetails) => KycPipelineStepView
> = {
  'selfie-quality': selfieStep,
  'aadhaar-face-match': faceMatchStep,
  'expression-anti-spoof': expressionStep,
  'active-liveness': activeLivenessStep,
};

/** Ordered MoneyCash KYC face pipeline steps for LOS (matches customer journey). */
export function buildKycPipelineSteps(row: LosApplicationDetails): KycPipelineStepView[] {
  return KYC_FACE_PIPELINE_DISPLAY_ORDER.map((id) => KYC_PIPELINE_STEP_BUILDERS[id](row));
}

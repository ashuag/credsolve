import { KYC_FACE_PIPELINE_STEPS } from '@/lib/kyc-face-pipeline';

export function KycFacePipelineSteps() {
  return (
    <ol className="m-0 grid list-none gap-2 p-0">
      {KYC_FACE_PIPELINE_STEPS.map((label, index) => (
        <li
          key={label}
          className="flex items-start gap-2.5 rounded-xl border border-[rgba(18,36,79,0.1)] bg-white/80 px-3 py-2 text-sm"
        >
          <span
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(20,150,243,0.12)] text-[0.72rem] font-extrabold text-[#1496f3]"
            aria-hidden
          >
            {index + 1}
          </span>
          <span className="font-semibold text-brand-navy">{label}</span>
        </li>
      ))}
    </ol>
  );
}

'use client';

type RouteTransitionLoaderProps = {
  destination: string;
};

export function RouteTransitionLoader({ destination }: RouteTransitionLoaderProps) {
  return (
    <div
      className="fixed inset-0 z-[140] grid place-items-center p-6 backdrop-blur-[14px] bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.22),transparent_30rem),radial-gradient(circle_at_bottom,rgba(34,197,94,0.18),transparent_28rem),rgba(9,19,47,0.42)]"
      role="status"
      aria-live="polite"
      aria-label={`Opening ${destination}`}
    >
      <div
        className="absolute top-[12%] right-[10%] h-[min(18rem,34vw)] w-[min(18rem,34vw)] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.2),transparent_68%)] animate-pulse"
        aria-hidden
      />

      <div className="relative w-[min(100%,30rem)] overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08)),linear-gradient(160deg,rgba(15,39,72,0.96),rgba(17,34,79,0.94))] p-7 shadow-[0_28px_72px_rgba(9,19,47,0.28)]">
        <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.12)] px-3 py-1.5 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-[#fff4c1]">
          <span className="h-2 w-2 rounded-full bg-[#4ADE80] shadow-[0_0_0_5px_rgba(34,197,94,0.18)]" aria-hidden />
          Navigation in progress
        </span>

        <div className="relative mt-7 grid min-h-[156px] place-items-center" aria-hidden>
          <div className="absolute h-[112px] w-[112px] rounded-full border-[3px] border-[rgba(255,255,255,0.16)] border-t-[#22C55E] animate-spin" />
          <div className="absolute h-[76px] w-[76px] rounded-full border-[3px] border-[rgba(34,197,94,0.18)] border-t-[#4ADE80] animate-spin [animation-direction:reverse] [animation-duration:1.4s]" />
          <div className="absolute h-[44px] w-[44px] rounded-full bg-[radial-gradient(circle_at_32%_30%,#fffbe6_0_20%,#4ADE80_38%,#22C55E_100%)] shadow-[0_0_0_12px_rgba(255,255,255,0.06),0_0_42px_rgba(34,197,94,0.26)]" />
        </div>

        <div className="grid gap-2">
          <h2 className="m-0 text-[clamp(1.8rem,4vw,2.4rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-[#fff9e8]">
            Opening {destination}
          </h2>
          <p className="m-0 text-[0.96rem] leading-[1.6] text-[rgba(240,245,255,0.84)]">
            Please wait while the next LOS screen finishes loading.
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
          <div className="h-[8px] w-[42%] animate-pulse rounded-full bg-[linear-gradient(90deg,#22C55E,#4ADE80,#22C55E)] [background-size:200%_100%]" />
        </div>
      </div>
    </div>
  );
}

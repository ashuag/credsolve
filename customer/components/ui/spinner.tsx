type SpinnerProps = {
  /** Diameter in pixels. Defaults to 40. */
  size?: number;
};

/** Branded circular loading indicator. */
export function Spinner({ size = 40 }: SpinnerProps) {
  return (
    <div
      className="rounded-full border-4 border-[#1c347d1a] border-t-brand-blue animate-spin"
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

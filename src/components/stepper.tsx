"use client";

function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = (v: number) => String(v),
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Verlagen"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex size-7 shrink-0 items-center justify-center rounded-full border border-neutral/40 text-ink transition-colors hover:bg-neutral/10 disabled:opacity-30"
      >
        −
      </button>
      <span className="w-14 text-center text-ink">{format(value)}</span>
      <button
        type="button"
        aria-label="Verhogen"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="flex size-7 shrink-0 items-center justify-center rounded-full border border-neutral/40 text-ink transition-colors hover:bg-neutral/10 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

export { Stepper };
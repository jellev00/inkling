import { cn } from "@/lib/utils";

function Squiggle({
  className,
  strokeClassName = "stroke-ink",
  dotClassName = "fill-energy",
}: {
  className?: string;
  strokeClassName?: string;
  dotClassName?: string;
}) {
  return (
    <svg
      viewBox="0 0 340 110"
      fill="none"
      aria-hidden="true"
      className={cn("w-full", className)}
    >
      <path
        d="M10 95 C55 35 95 115 145 65 C185 30 225 95 268 42"
        strokeWidth={4}
        strokeLinecap="round"
        className={strokeClassName}
      />
      <circle cx="270" cy="40" r="9" className={dotClassName} />
    </svg>
  );
}

export { Squiggle };
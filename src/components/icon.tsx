import { cn } from "@/lib/utils";

const ICONS = {
  "arrow-left": "arrow-left-solid-full",
  check: "check-solid-full",
  clock: "clock-regular-full",
  copy: "copy-solid-full",
  eraser: "eraser-solid-full",
  paintbrush: "paintbrush-solid-full",
  play: "play-solid-full",
  "trash-can": "trash-can-solid-full",
  "user-plus": "user-plus-solid-full",
  volume: "volume-solid-full",
  "volume-xmark": "volume-xmark-solid-full",
} as const;

export type IconName = keyof typeof ICONS;

function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const maskImage = `url(/icons/${ICONS[name]}.svg)`;
  return (
    <span
      role="presentation"
      className={cn("inline-block size-4 shrink-0 bg-current", className)}
      style={{
        WebkitMaskImage: maskImage,
        maskImage,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export { Icon };
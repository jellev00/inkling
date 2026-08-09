"use client";

import { PLAYER_COLOR_CLASSES, type PlayerColor } from "@/components/player-avatar";
import { cn } from "@/lib/utils";

const COLORS: PlayerColor[] = [1, 2, 3, 4, 5, 6];

function ColorSwatchPicker({
  value,
  onChange,
  className,
}: {
  value: PlayerColor;
  onChange: (color: PlayerColor) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("flex gap-2.5", className)}>
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={`Kleur ${color}`}
          onClick={() => onChange(color)}
          className={cn(
            "size-8 shrink-0 rounded-full transition-all",
            PLAYER_COLOR_CLASSES[color],
            value === color && "ring-2 ring-ink ring-offset-2 ring-offset-canvas"
          )}
        />
      ))}
    </div>
  );
}

export { ColorSwatchPicker };
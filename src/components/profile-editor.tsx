"use client";

import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { PlayerAvatar, type PlayerColor } from "@/components/player-avatar";
import { SectionLabel } from "@/components/section-label";
import { Input } from "@/components/ui/input";

function ProfileEditor({
  name,
  onNameChange,
  color,
  onColorChange,
  placeholder = "Jouw naam",
}: {
  name: string;
  onNameChange: (name: string) => void;
  color: PlayerColor;
  onColorChange: (color: PlayerColor) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Jouw profiel</SectionLabel>
      <div className="flex items-center gap-4">
        <PlayerAvatar name={name || ""} color={color} size="lg" />
        <div className="flex flex-1 flex-col gap-3">
          <Input
            value={name}
            onChange={(event) => onNameChange(event.target.value.slice(0, 20))}
            placeholder={placeholder}
            className="h-14 rounded-xl border-none bg-ink px-4 text-base font-bold text-white placeholder:text-white/40 focus-visible:ring-primary/50"
          />
          <ColorSwatchPicker value={color} onChange={onColorChange} />
        </div>
      </div>
    </div>
  );
}

export { ProfileEditor };
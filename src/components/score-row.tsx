import type { ReactNode } from "react";

import { PlayerAvatar, type PlayerColor } from "@/components/player-avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function HostBadge() {
  return <Badge variant="energy">Host</Badge>;
}

function ScoreRow({
  name,
  color,
  trailing,
  className,
}: {
  name: string;
  color: PlayerColor;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-neutral/40 bg-white px-4 py-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <PlayerAvatar name={name} color={color} size="sm" />
        <span className="text-sm font-medium text-ink">{name}</span>
      </div>
      {trailing}
    </div>
  );
}

export { ScoreRow, HostBadge };
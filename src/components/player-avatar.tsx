import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type PlayerColor = 1 | 2 | 3 | 4 | 5 | 6;

const PLAYER_COLOR_CLASSES: Record<PlayerColor, string> = {
  1: "bg-player-1",
  2: "bg-player-2",
  3: "bg-player-3",
  4: "bg-player-4",
  5: "bg-player-5",
  6: "bg-player-6",
};

const SIZE_CLASSES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-17 text-2xl",
} as const;

function initials(name: string) {
  const [first, second] = name.trim().split(/\s+/);
  return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase();
}

function PlayerAvatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color: PlayerColor;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZE_CLASSES[size], className)}>
      <AvatarFallback
        className={cn(
          PLAYER_COLOR_CLASSES[color],
          "font-bold text-white"
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export { PlayerAvatar, PLAYER_COLOR_CLASSES };
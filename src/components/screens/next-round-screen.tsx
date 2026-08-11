import { CountdownCircle } from "@/components/countdown-circle";
import { PlayerAvatar, type PlayerColor } from "@/components/player-avatar";
import type { Player } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

const NEXT_ROUND_INTRO_SECONDS = 10;

// Identiek voor iedereen, ongeacht of je zelf de nieuwe tekenaar bent —
// puur een korte introductie vóór het bestaande woordkeuze-/wachtscherm
// voor deze ronde-status.
function NextRoundScreen({
  drawerName,
  roundNumber,
  totalRounds,
  players,
  drawerId,
}: {
  drawerName: string;
  roundNumber: number;
  totalRounds: number;
  players: Player[];
  drawerId: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 bg-canvas px-6 py-16 text-center">
      <div className="flex flex-col gap-1">
        <p className="text-lg text-ink">{drawerName} is aan de beurt</p>
        <p className="text-base font-bold text-ink">
          Ronde {roundNumber} van de {totalRounds}
        </p>
      </div>

      <CountdownCircle seconds={NEXT_ROUND_INTRO_SECONDS} />

      <div className="flex items-center gap-3">
        {players.map((player) => (
          <PlayerAvatar
            key={player.id}
            name={player.name}
            color={player.avatar_color as PlayerColor}
            size="sm"
            className={cn(
              player.id === drawerId &&
                "ring-2 ring-ink ring-offset-2 ring-offset-canvas"
            )}
          />
        ))}
      </div>

      <p className="text-sm text-neutral">{drawerName} tekent deze ronde</p>
    </div>
  );
}

export { NextRoundScreen, NEXT_ROUND_INTRO_SECONDS };

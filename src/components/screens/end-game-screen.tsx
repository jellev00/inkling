"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { PlayerAvatar, type PlayerColor } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  markPlayerLeft,
  restartGame,
  type Player,
  type Room,
} from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

const PODIUM_BG_CLASSES: Record<PlayerColor, string> = {
  1: "bg-player-1/15",
  2: "bg-player-2/15",
  3: "bg-player-3/15",
  4: "bg-player-4/15",
  5: "bg-player-5/15",
  6: "bg-player-6/15",
};

const PODIUM_TEXT_CLASSES: Record<PlayerColor, string> = {
  1: "text-player-1",
  2: "text-player-2",
  3: "text-player-3",
  4: "text-player-4",
  5: "text-player-5",
  6: "text-player-6",
};

// Hoogte volgt de rangorde (1e > 2e > 3e), niet de absolute score.
const PODIUM_HEIGHT_CLASSES: Record<1 | 2 | 3, string> = {
  1: "h-24",
  2: "h-20",
  3: "h-16",
};

function PodiumColumn({ player, rank }: { player: Player; rank: 1 | 2 | 3 }) {
  const color = player.avatar_color as PlayerColor;

  return (
    <div className="flex flex-col items-center gap-2">
      <PlayerAvatar name={player.name} color={color} size={rank === 1 ? "md" : "sm"} />
      <span
        className={cn(
          "text-sm text-ink",
          rank === 1 ? "font-bold" : "font-medium"
        )}
      >
        {player.name}
      </span>
      <div
        className={cn(
          "flex w-20 items-start justify-center rounded-xl pt-3",
          PODIUM_HEIGHT_CLASSES[rank],
          PODIUM_BG_CLASSES[color]
        )}
      >
        <span className={cn("text-3xl font-bold", PODIUM_TEXT_CLASSES[color])}>
          {rank}
        </span>
      </div>
    </div>
  );
}

function EndGameScreen({
  room,
  players,
  isHost,
  userId,
}: {
  room: Room;
  players: Player[];
  isHost: boolean;
  userId: string | null;
}) {
  const router = useRouter();
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const [first, second, third] = sortedPlayers;

  async function handlePlayAgain() {
    if (!isHost || restarting) return;

    setRestarting(true);
    setRestartError(null);

    const supabase = createClient();
    const { error } = await restartGame(supabase, room.id);

    if (error) {
      console.error("restartGame failed:", error);
      setRestartError("Kon het spel niet herstarten.");
      setRestarting(false);
      return;
    }

    // rooms.status komt terug op 'lobby' via het Realtime-kanaal, dat
    // schakelt dan bij iedereen automatisch terug naar het Lobby-scherm.
  }

  // Gebruikt door zowel 'Nieuwe room' (host) als 'Verlaat de room'
  // (niet-host): eerst de eigen players-rij als vertrokken markeren (soft-
  // delete, scores/gokken blijven bestaan), dan pas navigeren.
  async function handleLeaveRoom() {
    if (leaving) return;
    setLeaving(true);

    if (userId) {
      const supabase = createClient();
      const { error } = await markPlayerLeft(supabase, room.id, userId);
      if (error) {
        console.error("markPlayerLeft failed:", error);
      }
    }

    router.push("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 bg-canvas px-6 py-16">
      <h1 className="text-center font-caveat text-5xl font-bold text-primary">
        Spel voorbij
      </h1>

      {sortedPlayers.length > 0 && (
        <div className="flex items-end justify-center gap-4">
          {second && <PodiumColumn player={second} rank={2} />}
          {first && <PodiumColumn player={first} rank={1} />}
          {third && <PodiumColumn player={third} rank={3} />}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {sortedPlayers.map((player) => (
          <div
            key={player.id}
            className="flex items-center gap-3 rounded-xl border border-neutral/30 bg-white px-4 py-3.5"
          >
            <PlayerAvatar
              name={player.name}
              color={player.avatar_color as PlayerColor}
              size="md"
            />
            <span className="text-base font-medium text-ink">
              {player.name}
            </span>
            <span className="ml-auto text-lg font-bold text-ink">
              {player.score}
            </span>
          </div>
        ))}
      </div>

      {restartError && (
        <p className="text-center text-sm text-error">{restartError}</p>
      )}

      {isHost ? (
        <div className="flex items-start gap-3">
          <Button
            className="h-12 flex-1 rounded-xl text-base font-bold"
            disabled={restarting}
            onClick={handlePlayAgain}
          >
            {restarting ? "Even geduld…" : "Nog een keer"}
          </Button>
          <Button
            variant="outline"
            className="h-12 flex-1 rounded-xl text-base font-bold text-neutral"
            disabled={leaving}
            onClick={handleLeaveRoom}
          >
            Nieuwe room
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="h-12 w-full rounded-xl text-base font-bold text-neutral"
          disabled={leaving}
          onClick={handleLeaveRoom}
        >
          Verlaat de room
        </Button>
      )}
    </div>
  );
}

export { EndGameScreen };

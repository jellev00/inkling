"use client";

import { useEffect, useState } from "react";

import { PlayerAvatar, type PlayerColor } from "@/components/player-avatar";
import { RoomcodeCard } from "@/components/roomcode-badge";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/session-context";
import {
  getRoomByCode,
  listPlayers,
  updateRoomStatus,
  type Player,
  type Room,
} from "@/lib/supabase/queries";

function LobbyScreen({ code }: { code: string }) {
  const { userId } = useSession();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const { data: roomData, error: roomError } = await getRoomByCode(
        supabase,
        code
      );
      if (!active) return;

      if (roomError || !roomData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setRoom(roomData);

      const { data: playerRows } = await listPlayers(supabase, roomData.id);
      if (!active) return;

      setPlayers(playerRows ?? []);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [code]);

  useEffect(() => {
    if (!room) return;

    const supabase = createClient();
    const roomId = room.id;

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const nextStatus = (payload.new as { status?: string }).status;
          if (nextStatus) {
            setRoom((current) =>
              current ? { ...current, status: nextStatus } : current
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newPlayer = payload.new as Player;
          setPlayers((current) =>
            current.some((player) => player.id === newPlayer.id)
              ? current
              : [...current, newPlayer]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const removedId = (payload.old as { id?: string }).id;
          if (!removedId) return;
          setPlayers((current) =>
            current.filter((player) => player.id !== removedId)
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };

  }, [room?.id]);

  const isHost = players.some(
    (player) => player.auth_user_id === userId && player.is_host
  );
  const gameStarted = room?.status !== undefined && room.status !== "lobby";

  async function handleStart() {
    if (!room || starting) return;

    setStarting(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await updateRoomStatus(
      supabase,
      room.id,
      "playing"
    );

    if (updateError) {
      console.error("updateRoomStatus failed:", updateError);
      setError(updateError.message);
      setStarting(false);
      return;
    }

  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-6">
        <p className="text-sm text-neutral">Room laden…</p>
      </div>
    );
  }

  if (notFound || !room) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 bg-canvas px-6 py-6">
        <ScreenHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-bold text-ink">Room niet gevonden</p>
          <p className="text-sm text-neutral">
            De code &ldquo;{code}&rdquo; bestaat niet (meer).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 bg-canvas px-6 py-6">
      <ScreenHeader />

      <RoomcodeCard code={room.code} label="Jouw roomcode" />

      <div className="flex flex-col gap-2">
        <p className="text-sm text-neutral">Spelers ({players.length})</p>
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center gap-3 rounded-xl border border-neutral/30 bg-white px-4 py-3"
          >
            <PlayerAvatar
              name={player.name}
              color={player.avatar_color as PlayerColor}
              size="sm"
            />
            <span className="text-sm font-medium text-ink">
              {player.name}
              {player.auth_user_id === userId && (
                <span className="text-neutral"> (jij)</span>
              )}
            </span>
            {player.is_host && (
              <span className="ml-auto text-xs font-medium text-primary">
                Host
              </span>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-center text-sm text-error">{error}</p>}

      {gameStarted ? (
        <p className="text-center text-sm font-medium text-primary">
          Het spel is gestart!
        </p>
      ) : isHost ? (
        <Button
          size="lg"
          className="h-14 w-full rounded-xl text-base font-bold"
          disabled={starting}
          onClick={handleStart}
        >
          {starting ? "Even geduld…" : "Spel starten"}
        </Button>
      ) : (
        <p className="text-center text-xs text-neutral">
          Wachten tot de host het spel start…
        </p>
      )}
    </div>
  );
}

export { LobbyScreen };

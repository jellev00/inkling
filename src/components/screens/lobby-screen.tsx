"use client";

import { useEffect, useState } from "react";

import { PlayerAvatar, type PlayerColor } from "@/components/player-avatar";
import { RoomcodeCard } from "@/components/roomcode-badge";
import { ScreenHeader } from "@/components/screen-header";
import { EndGameScreen } from "@/components/screens/end-game-screen";
import { RoundScreen } from "@/components/screens/round-screen";
import { Button } from "@/components/ui/button";
import { shuffleDrawOrder } from "@/lib/draw-order";
import { playSound } from "@/lib/sound";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/session-context";
import {
  createRound,
  deleteRound,
  getCurrentRound,
  getRoomByCode,
  listPlayers,
  updateRoomSettings,
  updateRoomStatus,
  type Player,
  type Room,
  type RoomSettings,
  type Round,
} from "@/lib/supabase/queries";

function LobbyScreen({ code }: { code: string }) {
  const { userId } = useSession();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [round, setRound] = useState<Round | null>(null);
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

      if (roomData.status !== "lobby") {
        const { data: roundData } = await getCurrentRound(
          supabase,
          roomData.id
        );
        if (!active) return;
        setRound(roundData ?? null);
      }

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
          const next = payload.new as {
            status?: string;
            settings?: RoomSettings;
          };
          if (next.status) {
            // settings meenemen is nodig zodra de host bij 'Spel starten'
            // de geschudde drawOrder wegschrijft — anders blijft de lokale
            // room-state (bij iedereen, ook de host zelf) op de oude
            // settings staan en ontbreekt drawOrder in RevealScreen.
            setRoom((current) =>
              current
                ? {
                    ...current,
                    status: next.status!,
                    settings: next.settings ?? current.settings,
                  }
                : current
            );

            // Na een herstart via 'Nog een keer' landt iedereen hier terug
            // zonder dat LobbyScreen opnieuw mount — zonder deze reset
            // blijft "Spel starten" hangen op "Even geduld…" van de vorige
            // keer.
            if (next.status === "lobby") {
              setStarting(false);
            }
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          // Vangt o.a. score-wijzigingen op die submit-guess server-side
          // doorvoert — zonder dit blijft het scorebord stil staan. Vangt
          // ook het soft-delete leave/rejoin-patroon op: left_at gezet
          // betekent uit de zichtbare lijst, left_at teruggezet op null
          // (bij een speler die nog niet lokaal zichtbaar was) betekent
          // terug toevoegen.
          const updatedPlayer = payload.new as Player;

          setPlayers((current) => {
            if (updatedPlayer.left_at) {
              return current.filter(
                (player) => player.id !== updatedPlayer.id
              );
            }

            const exists = current.some(
              (player) => player.id === updatedPlayer.id
            );
            if (!exists) {
              return [...current, updatedPlayer];
            }

            return current.map((player) =>
              player.id === updatedPlayer.id ? updatedPlayer : player
            );
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rounds",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setRound(payload.new as Round);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rounds",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const nextRound = payload.new as Round;
          setRound((current) => {
            // Eén plek voor het rondegeluid, ongeacht de oorzaak van de
            // overgang naar 'reveal' (tijd verstreken of iedereen geraden)
            // — beide resulteren hier in dezelfde status-update.
            if (nextRound.status === "reveal" && current?.status !== "reveal") {
              playSound("roundEnd");
            }
            return nextRound;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
    // Alleen resubscriben wanneer de room zelf wisselt, niet bij elke
    // status-/ronde-wijziging die dit effect via setRoom()/setRound() zelf
    // veroorzaakt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  const myPlayer = players.find((player) => player.auth_user_id === userId);
  const isHost = players.some(
    (player) => player.auth_user_id === userId && player.is_host
  );
  const gameStarted = room?.status !== undefined && room.status !== "lobby";

  async function handleStart() {
    if (!room || starting || players.length === 0) return;
    // Dekt de race waarbij een speler de room verlaat op het exacte moment
    // dat de host klikt — de disabled-knop alleen is niet genoeg, want die
    // state kan al stale zijn tegen de tijd dat deze handler uitvoert.
    if (players.length < 2) return;

    setStarting(true);
    setError(null);

    const supabase = createClient();

    // Eerlijke rotatie: de speellijst wordt hier eenmalig geschud en als
    // vaste volgorde bewaard, niet bij elke ronde opnieuw willekeurig
    // bepaald — zie getDrawerId in reveal-screen.tsx voor het vervolg.
    const drawOrder = shuffleDrawOrder(players);

    const { data: updatedRoom, error: settingsError } = await updateRoomSettings(
      supabase,
      room.id,
      { ...room.settings, drawOrder }
    );

    if (settingsError || !updatedRoom) {
      console.error("updateRoomSettings failed:", settingsError);
      setError(settingsError?.message ?? "Kon de tekenvolgorde niet opslaan.");
      setStarting(false);
      return;
    }

    const { data: newRound, error: roundError } = await createRound(
      supabase,
      { roomId: room.id, roundNumber: 1, drawerId: drawOrder[0] }
    );

    if (roundError || !newRound) {
      console.error("createRound failed:", roundError);
      setError(roundError?.message ?? "Kon de ronde niet starten.");
      setStarting(false);
      return;
    }

    const { error: updateError } = await updateRoomStatus(
      supabase,
      room.id,
      "playing"
    );

    if (updateError) {
      console.error("updateRoomStatus failed:", updateError);
      await deleteRound(supabase, newRound.id);
      setError(updateError.message);
      setStarting(false);
      return;
    }

    // room.status en de nieuwe ronde komen terug via het Realtime-kanaal.
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
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 bg-canvas px-6 py-6">
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

  if (room.status === "finished" && !myPlayer) {
    // Net gejoind terwijl het spel al afgelopen was (zie JoinRoomScreen,
    // die in dat geval geen players-rij aanmaakt) — geen eindstand tonen
    // waar deze speler met score 0 tussen zou staan.
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 bg-canvas px-6 py-6">
        <ScreenHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-neutral">
            Dit spel is afgelopen — wacht tot de host een nieuwe ronde start.
          </p>
        </div>
      </div>
    );
  }

  if (room.status === "finished") {
    return (
      <EndGameScreen
        room={room}
        players={players}
        isHost={isHost}
        userId={userId}
      />
    );
  }

  if (gameStarted) {
    return (
      <RoundScreen room={room} round={round} players={players} userId={userId} />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 bg-canvas px-6 py-6">
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

      {isHost ? (
        <div className="flex flex-col items-center gap-2">
          <Button
            size="lg"
            className="h-14 w-full rounded-xl text-base font-bold"
            disabled={starting || players.length < 2}
            onClick={handleStart}
          >
            {starting ? "Even geduld…" : "Spel starten"}
          </Button>
          {players.length < 2 && (
            <p className="text-center text-xs text-neutral">
              Wacht op nog minstens 1 speler...
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-xs text-neutral">
          Wachten tot de host het spel start…
        </p>
      )}
    </div>
  );
}

export { LobbyScreen };

"use client";

import { useEffect, useState } from "react";

import { CanvasBoard } from "@/components/canvas-board";
import { Icon } from "@/components/icon";
import { PlayerAvatar, type PlayerColor } from "@/components/player-avatar";
import { RoomcodeCompact } from "@/components/roomcode-badge";
import { RoundTimer } from "@/components/round-timer";
import { GuessPanel } from "@/components/screens/guess-panel";
import { WordSlots } from "@/components/word-slots";
import { isMuted, setMuted as persistMuted } from "@/lib/sound";
import { createClient } from "@/lib/supabase/client";
import { revealRound, type Player, type Room, type Round } from "@/lib/supabase/queries";

function GameScreen({
  room,
  round,
  players,
  userId,
  isDrawer,
  word,
}: {
  room: Room;
  round: Round;
  players: Player[];
  userId: string | null;
  isDrawer: boolean;
  word: string | null;
}) {
  const [muted, setMuted] = useState(isMuted);

  const myPlayer = players.find((player) => player.auth_user_id === userId);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Andere oorzaak (iedereen al geraden) wordt server-side afgehandeld in
  // submit-guess. Dit dekt het geval waarin de tijd gewoon verstrijkt —
  // alleen de tekenaar-client mag dit updaten (RLS "drawer updates own
  // round"), dus deze timer draait uitsluitend bij de tekenaar.
  useEffect(() => {
    if (!isDrawer || round.status !== "drawing" || !round.ends_at) return;

    const supabase = createClient();
    const delayMs = new Date(round.ends_at).getTime() - Date.now();

    const timeoutId = window.setTimeout(
      () => {
        void revealRound(supabase, round.id);
      },
      Math.max(delayMs, 0)
    );

    return () => window.clearTimeout(timeoutId);
  }, [isDrawer, round.id, round.status, round.ends_at]);

  const letters = isDrawer
    ? (word ?? "").split("")
    : Array.from({ length: round.word_length ?? 0 }, () => null);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 bg-canvas px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-caveat text-3xl font-bold text-primary">
            Inkling
          </span>
          <RoomcodeCompact code={room.code} className="px-4 py-2 text-base" />
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral">
            Ronde {round.round_number}/{room.settings.rounds}
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {room.settings.category}
          </span>
          <RoundTimer endsAt={round.ends_at} />
          <button
            type="button"
            aria-label={muted ? "Geluid aan" : "Geluid uit"}
            onClick={() =>
              setMuted((current) => {
                const next = !current;
                persistMuted(next);
                return next;
              })
            }
            className="text-neutral transition-colors hover:text-ink"
          >
            <Icon
              name={muted ? "volume-xmark" : "volume"}
              className="size-4"
            />
          </button>
        </div>
      </div>

      {/*
        Mobiel (< md): canvas, dan chat, dan spelerslijst — gestapeld op
        content-hoogte, niets rekt uit tot de resterende viewporthoogte.
        De sidebar-wrapper wordt op mobiel `contents` zodat de spelerslijst
        en GuessPanel als losse flex-items van deze kolom herordend kunnen
        worden met `order`; vanaf md geldt weer de originele naast-elkaar
        layout (canvas + vaste-breedte zijbalk).

        Desktop (lg): de rij zelf krijgt geen expliciete hoogte
        (lg:flex-none annuleert de md:flex-1-groei) — de hoogte volgt uit de
        linkerkolom (woord + canvas + tools), en lg:items-stretch rekt de
        zijbalk daar precies tot uit. De buitenste wrapper centreert dat
        geheel (beide kolommen samen) horizontaal én verticaal in de
        viewport i.p.v. linksboven te beginnen met lege ruimte eronder.
        lg:w-full lg:max-w-5xl op de rij zelf is nodig omdat een flex-item
        van een justify-center-container anders krimpt tot zijn kleinst
        mogelijke inhoud — zonder die breedte heeft md:flex-1 op de
        linkerkolom niets om in te groeien, en krimpen canvas én zijbalk
        mee.
      */}
      <div className="lg:flex lg:min-h-full lg:items-center lg:justify-center">
        <div className="flex flex-col gap-6 md:flex-1 lg:w-full lg:max-w-5xl lg:flex-none lg:flex-row lg:items-stretch">
          <div className="flex flex-col gap-4 max-md:order-1 md:flex-1">
            <WordSlots letters={letters} />

            {isDrawer && !word && (
              <p className="text-center text-xs text-error">
                Woord niet beschikbaar (dit kan gebeuren als je tijdens het
                tekenen ververst).
              </p>
            )}

            <CanvasBoard interactive={isDrawer} roundId={round.id} />
          </div>

          <div className="flex w-full flex-col gap-4 max-md:contents lg:w-80">
            <div className="flex flex-col gap-1.5 rounded-2xl border border-neutral/30 bg-white p-4 max-md:order-3">
              {sortedPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 px-1 py-1.5"
                >
                  <PlayerAvatar
                    name={player.name}
                    color={player.avatar_color as PlayerColor}
                    size="md"
                  />
                  <span className="text-base font-medium text-ink">
                    {player.name}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 text-base text-ink">
                    {player.id === round.drawer_id && (
                      <Icon
                        name="paintbrush"
                        className="size-3.5 text-neutral"
                      />
                    )}
                    {player.score}
                  </span>
                </div>
              ))}
            </div>

            <GuessPanel
              roundId={round.id}
              canGuess={!isDrawer}
              myName={myPlayer?.name ?? "Jij"}
              className="max-md:order-2 lg:min-h-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export { GameScreen };

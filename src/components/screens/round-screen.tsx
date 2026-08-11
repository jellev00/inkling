"use client";

import { useEffect, useRef, useState } from "react";

import { ScreenHeader } from "@/components/screen-header";
import { GameScreen } from "@/components/screens/game-screen";
import {
  NextRoundScreen,
  NEXT_ROUND_INTRO_SECONDS,
} from "@/components/screens/next-round-screen";
import { RevealScreen } from "@/components/screens/reveal-screen";
import { WordChoiceScreen } from "@/components/screens/word-choice-screen";
import { createClient } from "@/lib/supabase/client";
import { chooseRoundWord, type Player, type Room, type Round } from "@/lib/supabase/queries";

function RoundScreen({
  room,
  round,
  players,
  userId,
}: {
  room: Room;
  round: Round | null;
  players: Player[];
  userId: string | null;
}) {
  const [chosenWord, setChosenWord] = useState<string | null>(null);
  const [showNextRoundIntro, setShowNextRoundIntro] = useState(false);
  const previousRoundIdRef = useRef<string | null>(null);

  const myPlayer = players.find((player) => player.auth_user_id === userId);
  const drawer = players.find((player) => player.id === round?.drawer_id);
  const isDrawer = Boolean(
    myPlayer && round && myPlayer.id === round.drawer_id
  );

  // Elke nieuwe rij in `rounds` (ander id dan de vorige die deze client
  // zag) is een overgang naar een volgende ronde — behalve de allereerste
  // ronde die deze client observeert, want dat is gewoon "spel starten" of
  // een refresh, geen ronde-overgang. Toon dan 10 sec het introscherm,
  // ongeacht of je zelf de nieuwe tekenaar bent.
  useEffect(() => {
    if (!round) return;

    const isNewRound =
      previousRoundIdRef.current !== null &&
      previousRoundIdRef.current !== round.id;
    previousRoundIdRef.current = round.id;

    if (!isNewRound) return;

    setShowNextRoundIntro(true);
    const timeoutId = window.setTimeout(
      () => setShowNextRoundIntro(false),
      NEXT_ROUND_INTRO_SECONDS * 1000
    );
    return () => window.clearTimeout(timeoutId);
    // Alleen resubscriben wanneer het ronde-id zelf wisselt, niet bij
    // elke statuswijziging binnen dezelfde ronde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id]);

  async function handleWordChosen(word: string) {
    if (!round) return;

    const supabase = createClient();
    const { error } = await chooseRoundWord(supabase, {
      roundId: round.id,
      word,
      durationSeconds: room.settings.timePerRound,
    });

    if (error) throw error;

    setChosenWord(word);
    // round.status komt terug op 'drawing' via het Realtime-kanaal.
  }

  if (!round) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-6">
        <p className="text-sm text-neutral">Ronde laden…</p>
      </div>
    );
  }

  if (showNextRoundIntro) {
    return (
      <NextRoundScreen
        drawerName={drawer?.name ?? "De volgende speler"}
        roundNumber={round.round_number}
        totalRounds={room.settings.rounds}
        players={players}
        drawerId={round.drawer_id}
      />
    );
  }

  if (round.status === "choosing") {
    if (isDrawer) {
      return <WordChoiceScreen round={round} onChoose={handleWordChosen} />;
    }

    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 bg-canvas px-6 py-6">
        <ScreenHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-lg text-ink">
            <span className="font-bold">{drawer?.name ?? "De tekenaar"}</span>{" "}
            kiest een woord...
          </p>
        </div>
      </div>
    );
  }

  if (round.status === "reveal") {
    return (
      <RevealScreen
        room={room}
        round={round}
        players={players}
        isHost={Boolean(myPlayer?.is_host)}
      />
    );
  }

  return (
    <GameScreen
      room={room}
      round={round}
      players={players}
      userId={userId}
      isDrawer={isDrawer}
      word={isDrawer ? chosenWord : null}
    />
  );
}

export { RoundScreen };

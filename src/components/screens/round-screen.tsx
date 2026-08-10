"use client";

import { ScreenHeader } from "@/components/screen-header";
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
  const myPlayer = players.find((player) => player.auth_user_id === userId);
  const drawer = players.find((player) => player.id === round?.drawer_id);
  const isDrawer = Boolean(
    myPlayer && round && myPlayer.id === round.drawer_id
  );

  async function handleWordChosen(word: string) {
    if (!round) return;

    const supabase = createClient();
    const { error } = await chooseRoundWord(supabase, {
      roundId: round.id,
      word,
      durationSeconds: room.settings.timePerRound,
    });

    if (error) throw error;
    // round.status komt terug op 'drawing' via het Realtime-kanaal.
  }

  if (!round) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-6">
        <p className="text-sm text-neutral">Ronde laden…</p>
      </div>
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 bg-canvas px-6 py-6">
      <ScreenHeader />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-bold text-ink">Ronde gestart!</p>
        {round.word_length && (
          <p className="text-2xl tracking-widest text-neutral">
            {"_ ".repeat(round.word_length).trim()} ({round.word_length})
          </p>
        )}
        <p className="text-xs text-neutral">
          Teken- en raadscherm volgt nog — dit bevestigt dat de rondewissel
          werkt.
        </p>
      </div>
    </div>
  );
}

export { RoundScreen };

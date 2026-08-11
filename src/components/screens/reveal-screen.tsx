"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icon";
import { PlayerAvatar, type PlayerColor } from "@/components/player-avatar";
import { createClient } from "@/lib/supabase/client";
import {
  listRoundGuesses,
  type Player,
  type Round,
  type RoundGuess,
} from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

const NEXT_ROUND_COUNTDOWN_SECONDS = 3;

// Moet gelijk blijven aan DRAWER_BONUS_POINTS in
// supabase/functions/submit-guess/index.ts — dat is waar dit bedrag
// daadwerkelijk aan players.score wordt toegekend, hier wordt het enkel
// opnieuw afgeleid voor de weergave.
const DRAWER_BONUS_POINTS = 5;

// Identiek voor tekenaar en raders: geen van beiden kent het woord meer
// betrouwbaar op dit punt (de tekenaar z'n lokale state kan al leeg zijn na
// een refresh), dus iedereen haalt het via get-round-word op — die geeft
// het woord pas terug zodra rounds.status effectief 'reveal' is.
function RevealScreen({
  round,
  players,
}: {
  round: Round;
  players: Player[];
}) {
  const [word, setWord] = useState<string | null>(null);
  const [wordError, setWordError] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<RoundGuess[] | null>(null);
  const [countdown, setCountdown] = useState(NEXT_ROUND_COUNTDOWN_SECONDS);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const [wordResult, guessesResult] = await Promise.all([
        supabase.functions.invoke("get-round-word", {
          body: { round_id: round.id },
        }),
        listRoundGuesses(supabase, round.id),
      ]);

      if (!active) return;

      const fetchedWord = (wordResult.data as { word?: string } | null)
        ?.word;
      if (wordResult.error || !fetchedWord) {
        console.error("get-round-word failed:", wordResult.error);
        setWordError("Kon het woord niet ophalen.");
      } else {
        setWord(fetchedWord);
      }

      if (guessesResult.error) {
        console.error("listRoundGuesses failed:", guessesResult.error);
        setGuesses([]);
      } else {
        setGuesses(guessesResult.data ?? []);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [round.id]);

  // Puur cosmetisch aftellen — de daadwerkelijke overgang naar de
  // volgende ronde wordt in een volgende stap gebouwd.
  useEffect(() => {
    if (countdown <= 0) return;
    const id = window.setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [countdown]);

  const guessesByPlayer = new Map<string, RoundGuess[]>();
  for (const guess of guesses ?? []) {
    const list = guessesByPlayer.get(guess.player_id) ?? [];
    list.push(guess);
    guessesByPlayer.set(guess.player_id, list);
  }

  // listRoundGuesses sorteert al op guessed_at oplopend, dus de eerste
  // correcte rij hier is meteen de vroegste.
  const firstCorrect = (guesses ?? []).find((guess) => guess.correct);
  const firstCorrectPlayer = firstCorrect
    ? players.find((player) => player.id === firstCorrect.player_id)
    : undefined;
  const secondsToFirstCorrect =
    firstCorrect && round.started_at
      ? Math.max(
          0,
          Math.round(
            (new Date(firstCorrect.guessed_at).getTime() -
              new Date(round.started_at).getTime()) /
              1000
          )
        )
      : null;

  const correctGuessCount = (guesses ?? []).filter(
    (guess) => guess.correct
  ).length;
  const drawerBonus = correctGuessCount * DRAWER_BONUS_POINTS;

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 bg-canvas px-6 py-16">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-base text-ink">Het woord was</p>
        {wordError ? (
          <p className="text-sm text-error">{wordError}</p>
        ) : (
          <h1 className="font-caveat text-5xl font-bold text-ink">
            {word ?? "…"}
          </h1>
        )}
      </div>

      {firstCorrectPlayer && firstCorrect && (
        <div className="flex items-start gap-3 rounded-2xl bg-success/15 px-5 py-4">
          <Icon name="check" className="mt-1 size-4 shrink-0 text-success" />
          <p className="text-sm text-success">
            <span className="font-bold">
              {firstCorrectPlayer.name} raadde het eerst - na{" "}
              {secondsToFirstCorrect} sec
            </span>
            <span className="block">
              +{firstCorrect.points_awarded} punten
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral">Scorebord</p>

        {sortedPlayers.map((player) => {
          const isDrawer = player.id === round.drawer_id;

          // De tekenaar gokt nooit mee, dus die heeft nooit een eigen
          // guesses-rij — "Geen gok" zou hier misleidend zijn. Toon in
          // plaats daarvan de bonuspunten die de tekenaar deze ronde
          // verdiende (0 als niemand het woord raadde).
          const playerGuesses = isDrawer
            ? null
            : guessesByPlayer.get(player.id);
          const showsPointDelta = isDrawer || Boolean(playerGuesses?.length);
          const delta = isDrawer
            ? drawerBonus
            : (playerGuesses ?? []).reduce(
                (sum, guess) => sum + guess.points_awarded,
                0
              );

          return (
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
              <div className="ml-auto flex items-center gap-3">
                {showsPointDelta ? (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      delta > 0 ? "text-success" : "text-neutral"
                    )}
                  >
                    +{delta}
                  </span>
                ) : (
                  <span className="text-sm text-neutral">Geen gok</span>
                )}
                <span className="text-lg font-bold text-ink">
                  {player.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-neutral">
        Volgende ronde begint over {countdown}...
      </p>
    </div>
  );
}

export { RevealScreen };

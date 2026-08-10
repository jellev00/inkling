"use client";

import { useState, type FormEvent } from "react";

import { Input } from "@/components/ui/input";

type LocalGuess = { id: number; playerName: string; text: string };

// Lokaal-only chatlog: nog niet gesynchroniseerd tussen spelers en er is
// geen scoring/correctheids-check — dat komt met de volgende stap.
function GuessPanel({
  canGuess,
  myName,
}: {
  canGuess: boolean;
  myName: string;
}) {
  const [guesses, setGuesses] = useState<LocalGuess[]>([]);
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    setGuesses((current) => [
      ...current,
      { id: Date.now(), playerName: myName, text: trimmed },
    ]);
    setValue("");
  }

  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-neutral/30 bg-white">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {guesses.length === 0 ? (
          <p className="text-sm text-neutral">Nog geen gokken...</p>
        ) : (
          guesses.map((guess) => (
            <p key={guess.id} className="text-sm text-ink">
              <span className="font-bold">{guess.playerName}:</span>{" "}
              {guess.text}
            </p>
          ))
        )}
      </div>

      {canGuess && (
        <form
          onSubmit={handleSubmit}
          className="border-t border-neutral/20 p-3"
        >
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Type je antwoord..."
            className="h-11 rounded-xl border-none bg-ink px-4 text-white placeholder:text-white/40 focus-visible:ring-primary/50"
          />
        </form>
      )}
    </div>
  );
}

export { GuessPanel };

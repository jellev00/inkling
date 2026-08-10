"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Round } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

const CHOOSE_DURATION_MS = 5000;

function WordChoiceScreen({
  round,
  onChoose,
}: {
  round: Round;
  onChoose: (word: string) => Promise<void>;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [choices, setChoices] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(CHOOSE_DURATION_MS);

  useEffect(() => {
    let active = true;

    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke(
        "get-word-choices",
        { body: { round_id: round.id } }
      );

      if (!active) return;

      if (error || !Array.isArray(data)) {
        console.error("get-word-choices failed:", error);
        setChoices(null);
        setLoadError("Kon geen woordkeuzes ophalen.");
        return;
      }

      setLoadError(null);
      setChoices(data as string[]);
      setRemainingMs(CHOOSE_DURATION_MS);
    }

    load();

    return () => {
      active = false;
    };
  }, [round.id, reloadKey]);

  async function submitWord(word: string) {
    setSelected(word);
    setSubmitting(true);
    setSubmitError(null);

    try {
      await onChoose(word);
    } catch (err) {
      console.error("onChoose failed:", err);
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Opslaan van het woord is niet gelukt."
      );
      setSubmitting(false);
      setSelected(null);
    }
  }

  // Altijd de laatste submitWord aanroepen vanuit de interval-callback,
  // zonder dat die functie zelf in de effect-dependencies hoeft te staan
  // (anders herstart de timer bij elke re-render). De ref wordt na render
  // bijgewerkt via een effect, niet tijdens render zelf.
  const submitRef = useRef(submitWord);
  useEffect(() => {
    submitRef.current = submitWord;
  });

  useEffect(() => {
    if (!choices || selected) return;

    const start = Date.now();
    const id = window.setInterval(() => {
      const remaining = Math.max(0, CHOOSE_DURATION_MS - (Date.now() - start));
      setRemainingMs(remaining);

      if (remaining <= 0) {
        window.clearInterval(id);
        const randomWord = choices[Math.floor(Math.random() * choices.length)];
        submitRef.current(randomWord);
      }
    }, 100);

    return () => window.clearInterval(id);
  }, [choices, selected]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 bg-canvas px-6 py-16 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="font-caveat text-5xl font-bold text-primary">
          Jij bent aan de beurt!
        </h1>
        <p className="text-base text-ink">
          Kies een woord om te tekenen - de anderen zien dit niet
        </p>
      </div>

      {loadError ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-error">{loadError}</p>
          <Button
            className="rounded-xl"
            onClick={() => {
              setLoadError(null);
              setReloadKey((key) => key + 1);
            }}
          >
            Opnieuw proberen
          </Button>
        </div>
      ) : !choices ? (
        <p className="text-sm text-neutral">Woorden laden…</p>
      ) : (
        <div className="flex w-full flex-col gap-3">
          {choices.map((word) => (
            <button
              key={word}
              type="button"
              disabled={submitting}
              onClick={() => submitWord(word)}
              className={cn(
                "w-full rounded-xl border px-5 py-4 text-left text-lg transition-colors disabled:cursor-not-allowed",
                selected === word
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-neutral/40 bg-white text-ink/50 hover:border-primary/40"
              )}
            >
              {word}
            </button>
          ))}

          <div className="mt-2 flex flex-col items-center gap-1.5">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-neutral/30">
              <div
                className="h-full rounded-full bg-energy"
                style={{
                  width: `${(remainingMs / CHOOSE_DURATION_MS) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-neutral">
              {Math.ceil(CHOOSE_DURATION_MS / 1000)} sec om te kiezen
            </p>
          </div>

          {submitError && (
            <p className="text-center text-sm text-error">{submitError}</p>
          )}
        </div>
      )}
    </div>
  );
}

export { WordChoiceScreen };

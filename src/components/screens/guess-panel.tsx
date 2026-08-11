"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type ChatMessage =
  | { id: string; playerName: string; correct: true }
  | { id: string; playerName: string; correct: false; text: string };

// Berichten komen uitsluitend binnen via de round-${roundId}-chat
// broadcast — ook voor je eigen gok, zodat de weergegeven punten/juistheid
// altijd overeenkomen met wat de server (submit-guess) heeft bepaald.
function GuessPanel({
  roundId,
  canGuess,
}: {
  roundId: string;
  canGuess: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageIdRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`round-${roundId}-chat`)
      .on("broadcast", { event: "guess" }, ({ payload }) => {
        messageIdRef.current += 1;
        setMessages((current) => [
          ...current,
          { id: `${messageIdRef.current}`, ...payload } as ChatMessage,
        ]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    setValue("");

    const supabase = createClient();
    const { error: invokeError } = await supabase.functions.invoke(
      "submit-guess",
      { body: { round_id: roundId, guess_text: trimmed } }
    );

    if (invokeError) {
      setError("Kon je gok niet versturen, probeer opnieuw.");
    }

    setSubmitting(false);
  }

  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-neutral/30 bg-white">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-neutral">Nog geen gokken...</p>
        ) : (
          messages.map((message) =>
            message.correct ? (
              <p key={message.id} className="text-sm text-success">
                <span className="font-bold">{message.playerName}</span> heeft
                het geraden!
              </p>
            ) : (
              <p key={message.id} className="text-sm text-ink">
                <span className="font-bold">{message.playerName}:</span>{" "}
                {message.text}
              </p>
            )
          )
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
            disabled={submitting}
            className="h-11 rounded-xl border-none bg-ink px-4 text-white placeholder:text-white/40 focus-visible:ring-primary/50"
          />
          {error && <p className="mt-2 text-xs text-error">{error}</p>}
        </form>
      )}
    </div>
  );
}

export { GuessPanel };

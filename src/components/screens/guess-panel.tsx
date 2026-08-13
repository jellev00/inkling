"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { playSound } from "@/lib/sound";

type GuessBroadcastPayload =
  | { playerName: string; correct: true }
  | { playerName: string; correct: false; text: string };

type ChatMessage = {
  id: string;
  playerName: string;
  status: "pending" | "correct" | "incorrect" | "failed";
  // Ontbreekt voor andermans correcte gok (het woord lekt niet), wel
  // aanwezig voor je eigen (nog) pending gok, andermans foute gok, en je
  // eigen bevestigd-foute gok.
  text?: string;
};

// Berichten van andere spelers komen uitsluitend binnen via de
// round-${roundId}-chat broadcast. Je eigen gok verschijnt optimistic al
// vóór de submit-guess-aanroep klaar is, en wordt bijgewerkt zodra de
// bijbehorende broadcast (of een foutmelding) terugkomt — zo blijft de
// weergegeven correctheid/punten uiteindelijk altijd wat de server bepaalt.
function GuessPanel({
  roundId,
  canGuess,
  myName,
  className,
}: {
  roundId: string;
  canGuess: boolean;
  myName: string;
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState("");
  const messageIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Scrollt enkel de berichtenlijst zelf naar het nieuwste bericht (block:
  // "nearest" voorkomt dat de hele pagina meescrollt) — de gebruiker kan
  // intussen vrij omhoog scrollen om oudere berichten te herlezen; bij het
  // eerstvolgende nieuwe bericht springt de lijst gewoon weer naar beneden.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`round-${roundId}-chat`)
      .on("broadcast", { event: "guess" }, ({ payload }) => {
        const data = payload as GuessBroadcastPayload;

        // Voor iedereen in de ronde — tekenaar én raders — zodra de
        // correcte-gok-broadcast binnenkomt, ongeacht wie er raadde.
        if (data.correct) {
          playSound("correct");
        }

        setMessages((current) => {
          // Eigen, nog niet bevestigde gok? Werk die in-place bij i.p.v.
          // een dubbel bericht toe te voegen.
          const pendingIndex = current.findIndex(
            (message) =>
              message.status === "pending" &&
              message.playerName === data.playerName
          );

          if (pendingIndex !== -1) {
            const updated = [...current];
            updated[pendingIndex] = {
              ...updated[pendingIndex],
              status: data.correct ? "correct" : "incorrect",
              text: data.correct ? undefined : data.text,
            };
            return updated;
          }

          messageIdRef.current += 1;
          return [
            ...current,
            {
              id: `remote-${messageIdRef.current}`,
              playerName: data.playerName,
              status: data.correct ? "correct" : "incorrect",
              text: data.correct ? undefined : data.text,
            },
          ];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    setValue("");

    const clientId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: clientId, playerName: myName, status: "pending", text: trimmed },
    ]);

    const supabase = createClient();
    const { error: invokeError } = await supabase.functions.invoke(
      "submit-guess",
      { body: { round_id: roundId, guess_text: trimmed } }
    );

    // Bij succes wordt dit bericht bijgewerkt zodra de round-chat broadcast
    // binnenkomt (zie het effect hierboven) — de server bepaalt correct/
    // incorrect autoritatief, niet deze response.
    if (invokeError) {
      setMessages((current) =>
        current.map((message) =>
          message.id === clientId
            ? { ...message, status: "failed" }
            : message
        )
      );
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-neutral/30 bg-white md:flex-1",
        className
      )}
    >
      <div className="max-md:max-h-64 flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-neutral">Nog geen gokken...</p>
        ) : (
          messages.map((message) => {
            if (message.status === "correct") {
              return (
                <p key={message.id} className="text-sm text-success">
                  <span className="font-bold">{message.playerName}</span>{" "}
                  heeft het geraden!
                </p>
              );
            }

            return (
              <p
                key={message.id}
                className={cn(
                  "text-sm",
                  message.status === "failed"
                    ? "text-error"
                    : message.status === "pending"
                      ? "text-neutral"
                      : "text-ink"
                )}
              >
                <span className="font-bold">{message.playerName}:</span>{" "}
                {message.text}
                {message.status === "failed" && " (versturen mislukt)"}
              </p>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canGuess && (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-neutral/20 p-3"
        >
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Type je antwoord..."
            className="h-11 flex-1 rounded-xl border-none bg-ink px-4 text-white placeholder:text-white/40 focus-visible:ring-primary/50"
          />
          <button
            type="submit"
            aria-label="Verstuur"
            disabled={!value.trim()}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors disabled:opacity-40"
          >
            <Icon name="arrow-left" className="size-4 rotate-180" />
          </button>
        </form>
      )}
    </div>
  );
}

export { GuessPanel };

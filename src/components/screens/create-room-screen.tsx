"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ProfileEditor } from "@/components/profile-editor";
import { RoomcodeCard } from "@/components/roomcode-badge";
import { ScreenHeader } from "@/components/screen-header";
import { SectionLabel } from "@/components/section-label";
import { Squiggle } from "@/components/squiggle";
import { Stepper } from "@/components/stepper";
import type { PlayerColor } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { generateRoomCode } from "@/lib/room-code";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/session-context";
import {
  addPlayer,
  createRoom,
  deleteRoom,
  generateUniqueRoomCode,
} from "@/lib/supabase/queries";

const FALLBACK_CATEGORIES = ["Algemeen"];

function CreateRoomScreen() {
  const router = useRouter();
  const { userId, loading: sessionLoading } = useSession();

  const [code, setCode] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<PlayerColor>(1);
  const [rounds, setRounds] = useState(5);
  const [timePerRound, setTimePerRound] = useState(80);
  const [categories, setCategories] = useState<string[] | null>(null);
  const [category, setCategory] = useState(FALLBACK_CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mount-only client value (avoids a hydration mismatch from Math.random()
    // running on both server and client with different results).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(generateRoomCode());
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadCategories() {
      const { data, error: fetchError } = await supabase
        .from("word_categories")
        .select("category");

      if (!active) return;

      if (fetchError) {
        console.error("word_categories fetch failed:", fetchError);
      }

      const fetched = data?.map((row) => row.category).filter(Boolean) ?? [];
      const result = fetched.length > 0 ? fetched : FALLBACK_CATEGORIES;

      setCategories(result);
      setCategory((current) => (result.includes(current) ? current : result[0]));
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Vul je naam in.");
      return;
    }
    if (!userId) {
      setError("Nog aan het inloggen, probeer het zo opnieuw.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    let roomCode: string;
    try {
      roomCode = await generateUniqueRoomCode(supabase, {
        preferredCode: code ?? undefined,
      });
    } catch (err) {
      console.error("generateUniqueRoomCode failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Kon geen unieke roomcode genereren. Probeer opnieuw."
      );
      setSubmitting(false);
      return;
    }

    const { data: room, error: roomError } = await createRoom(supabase, {
      code: roomCode,
      hostId: userId,
      settings: { rounds, timePerRound, category },
    });

    if (roomError || !room) {
      console.error("createRoom failed:", roomError);
      setError(roomError?.message ?? "Room aanmaken is niet gelukt.");
      setSubmitting(false);
      return;
    }

    const { error: playerError } = await addPlayer(supabase, {
      authUserId: userId,
      roomId: room.id,
      name: trimmedName,
      avatarColor: color,
      isHost: true,
    });

    if (playerError) {
      console.error("addPlayer (host) failed:", playerError);
      await deleteRoom(supabase, room.id);
      setError(playerError.message ?? "Room aanmaken is niet gelukt.");
      setSubmitting(false);
      return;
    }

    router.push(`/room/${room.code}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 bg-canvas px-6 py-6">
      <ScreenHeader />

      <RoomcodeCard code={code ?? "••••"} label="Jouw roomcode" />

      <ProfileEditor
        name={name}
        onNameChange={setName}
        color={color}
        onColorChange={setColor}
      />

      <Card className="relative overflow-hidden rounded-2xl border-neutral/30">
        <Squiggle
          className="pointer-events-none absolute top-1/2 left-1/2 hidden w-64 -translate-x-1/2 -translate-y-1/2 opacity-60 min-[768px]:block"
          strokeClassName="stroke-neutral"
          dotClassName="fill-energy/40"
        />
        <CardContent className="gap-4">
          <SectionLabel>Spelinstellingen</SectionLabel>

          <div className="flex items-center justify-between">
            <span className="font-bold text-ink">Aantal rondes</span>
            <Stepper value={rounds} onChange={setRounds} min={3} max={10} />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-bold text-ink">Tijd per ronde</span>
            <Stepper
              value={timePerRound}
              onChange={setTimePerRound}
              min={30}
              max={120}
              step={10}
              format={(v) => `${v} sec`}
            />
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-bold text-ink">Woordcategorie</span>
            {categories === null ? (
              <p className="text-sm text-neutral">Categorieën laden…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCategory(option)}
                    className={
                      category === option
                        ? "rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                        : "rounded-full border border-neutral/40 px-4 py-2 text-sm font-medium text-ink/70"
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-center text-sm text-error">{error}</p>}

      <Button
        size="lg"
        className="h-14 w-full rounded-xl text-base font-bold"
        disabled={submitting || sessionLoading || !code}
        onClick={handleCreate}
      >
        {submitting ? "Even geduld…" : "Room aanmaken"}
      </Button>
    </div>
  );
}

export { CreateRoomScreen };
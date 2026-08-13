"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ProfileEditor } from "@/components/profile-editor";
import { RoomcodeCard } from "@/components/roomcode-badge";
import { ScreenHeader } from "@/components/screen-header";
import type { PlayerColor } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/supabase/session-context";
import {
  addPlayer,
  getPlayerByAuthUserId,
  getPlayerCount,
  getRoomByCode,
  rejoinPlayer,
  type Room,
} from "@/lib/supabase/queries";

function JoinRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const { userId, loading: sessionLoading } = useSession();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<PlayerColor>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const { data, error: fetchError } = await getRoomByCode(supabase, code);

      if (!active) return;

      if (fetchError) {
        console.error("getRoomByCode failed:", fetchError);
        setLoadError(fetchError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setRoom(data);

      const count = await getPlayerCount(supabase, data.id);
      if (!active) return;

      setColor(((count % 6) + 1) as PlayerColor);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [code]);

  async function handleJoin() {
    if (!room) return;

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

    const { data: freshRoom, error: fetchError } = await getRoomByCode(
      supabase,
      code
    );
    if (fetchError) {
      console.error("getRoomByCode failed:", fetchError);
      setError(fetchError.message);
      setSubmitting(false);
      return;
    }
    if (!freshRoom) {
      setNotFound(true);
      setSubmitting(false);
      return;
    }

    if (freshRoom.status === "finished") {
      // Geen players-rij aanmaken voor een spel dat al voorbij is — anders
      // duikt deze speler met score 0 op tussen de eindstand. LobbyScreen
      // toont in dat geval een korte melding in plaats van het scherm.
      router.push(`/room/${freshRoom.code}`);
      return;
    }

    // await voor user
    // const { data: { user } } = await supabase.auth.getUser();

    const { data: { user } } = await supabase.auth.getUser(); console.log('auth user:', user?.id, '| userId uit context:', userId);

    // Kijk of er al een players-rij is voor deze (room, gebruiker) —
    // mogelijk eerder vertrokken (left_at gezet). Update die dan i.p.v.
    // een nieuwe insert te proberen, anders knalt de unique constraint op
    // (room_id, auth_user_id).
    const { data: existingPlayer, error: existingPlayerError } =
      await getPlayerByAuthUserId(supabase, freshRoom.id, userId);

    if (existingPlayerError) {
      console.error("getPlayerByAuthUserId failed:", existingPlayerError);
      setError(existingPlayerError.message ?? "Joinen is niet gelukt.");
      setSubmitting(false);
      return;
    }

    if (existingPlayer) {
      const { error: rejoinError } = await rejoinPlayer(
        supabase,
        existingPlayer.id,
        { name: trimmedName, avatarColor: color }
      );

      if (rejoinError) {
        console.error("rejoinPlayer failed:", rejoinError);
        setError(rejoinError.message ?? "Joinen is niet gelukt.");
        setSubmitting(false);
        return;
      }
    } else {
      const { error: playerError } = await addPlayer(supabase, {
        authUserId: userId,
        roomId: freshRoom.id,
        name: trimmedName,
        avatarColor: color,
        isHost: false,
      });

      if (playerError) {
        console.error("addPlayer failed:", playerError);
        setError(playerError.message ?? "Joinen is niet gelukt.");
        setSubmitting(false);
        return;
      }
    }

    router.push(`/room/${freshRoom.code}`);
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-6">
        <p className="text-sm text-neutral">Room zoeken…</p>
      </div>
    );
  }

  if (notFound || loadError) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 bg-canvas px-6 py-6">
        <ScreenHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-bold text-ink">
            {loadError ? "Er ging iets mis" : "Room niet gevonden"}
          </p>
          <p className="text-sm text-neutral">
            {loadError ??
              `De code "${code}" bestaat niet (meer). Controleer de code of vraag een nieuwe aan de host.`}
          </p>
          <Button className="mt-4 rounded-xl" onClick={() => router.push("/")}>
            Terug naar start
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 bg-canvas px-6 py-6">
      <ScreenHeader />

      <RoomcodeCard code={room!.code} label="Roomcode" />

      <ProfileEditor
        name={name}
        onNameChange={setName}
        color={color}
        onColorChange={setColor}
      />

      {error && <p className="text-center text-sm text-error">{error}</p>}

      <Button
        size="lg"
        className="h-14 w-full rounded-xl text-base font-bold"
        disabled={submitting || sessionLoading}
        onClick={handleJoin}
      >
        {submitting ? "Even geduld…" : "Join room"}
      </Button>
    </div>
  );
}

export { JoinRoomScreen };
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlayerColor } from "@/components/player-avatar";
import { generateRoomCode } from "@/lib/room-code";

export type RoomSettings = {
  rounds: number;
  timePerRound: number;
  category: string;
};

export type Room = {
  id: string;
  code: string;
  host_id: string;
  status: string;
  settings: RoomSettings;
  created_at: string;
};

export type Player = {
  id: string;
  room_id: string;
  auth_user_id: string;
  name: string;
  avatar_color: PlayerColor;
  score: number;
  is_host: boolean;
  connected: boolean;
  joined_at: string;
  left_at: string | null;
};

const PLAYER_COLUMNS =
  "id, room_id, auth_user_id, name, avatar_color, score, is_host, connected, joined_at, left_at";

export async function getRoomByCode(supabase: SupabaseClient, code: string) {
  return supabase
    .from("rooms")
    .select("id, code, host_id, status, settings, created_at")
    .eq("code", code)
    .maybeSingle<Room>();
}

export async function generateUniqueRoomCode(
  supabase: SupabaseClient,
  options?: { preferredCode?: string; maxAttempts?: number }
) {
  const maxAttempts = options?.maxAttempts ?? 5;

  for (let i = 0; i < maxAttempts; i++) {
    const candidate =
      i === 0 && options?.preferredCode
        ? options.preferredCode
        : generateRoomCode();
    const { data, error } = await getRoomByCode(supabase, candidate);
    if (error) throw error;
    if (!data) return candidate;
  }

  throw new Error("Kon geen unieke roomcode genereren, probeer opnieuw.");
}

export async function createRoom(
  supabase: SupabaseClient,
  params: { code: string; hostId: string; settings: RoomSettings }
) {
  return supabase
    .from("rooms")
    .insert({
      code: params.code,
      host_id: params.hostId,
      status: "lobby",
      settings: params.settings,
    })
    .select("id, code, host_id, status, settings, created_at")
    .single<Room>();
}

export async function deleteRoom(supabase: SupabaseClient, roomId: string) {
  return supabase.from("rooms").delete().eq("id", roomId);
}

export async function getPlayerCount(supabase: SupabaseClient, roomId: string) {
  const { count } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .is("left_at", null);
  return count ?? 0;
}

export async function addPlayer(
  supabase: SupabaseClient,
  params: {
    authUserId: string;
    roomId: string;
    name: string;
    avatarColor: PlayerColor;
    isHost: boolean;
  }
) {
  return supabase
    .from("players")
    .insert({
      auth_user_id: params.authUserId,
      room_id: params.roomId,
      name: params.name,
      avatar_color: params.avatarColor,
      score: 0,
      is_host: params.isHost,
      connected: true,
    })
    .select(PLAYER_COLUMNS)
    .single<Player>();
}

// Filtert bewust niet op left_at: JoinRoomScreen gebruikt dit om te
// bepalen of een (room_id, auth_user_id)-combinatie al bestaat — ook als
// die eerder vertrokken is — om te kiezen tussen updaten en invoegen.
export async function getPlayerByAuthUserId(
  supabase: SupabaseClient,
  roomId: string,
  authUserId: string
) {
  return supabase
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("room_id", roomId)
    .eq("auth_user_id", authUserId)
    .maybeSingle<Player>();
}

// Soft-delete: de players-rij blijft bestaan (scores/gokken uit eerdere
// rondes moeten intact blijven), enkel left_at wordt gezet. Elders wordt
// een niet-lege left_at gebruikt om de speler uit zichtbare lijsten te
// filteren.
export async function markPlayerLeft(
  supabase: SupabaseClient,
  roomId: string,
  authUserId: string
) {
  return supabase
    .from("players")
    .update({ left_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("auth_user_id", authUserId);
}

// Zet een eerder vertrokken speler weer op actief bij het opnieuw joinen
// via dezelfde (room_id, auth_user_id) — voorkomt de duplicate-key-fout
// van een nieuwe insert-poging.
export async function rejoinPlayer(
  supabase: SupabaseClient,
  playerId: string,
  params: { name: string; avatarColor: PlayerColor }
) {
  return supabase
    .from("players")
    .update({
      name: params.name,
      avatar_color: params.avatarColor,
      left_at: null,
    })
    .eq("id", playerId)
    .select(PLAYER_COLUMNS)
    .single<Player>();
}

export async function listPlayers(supabase: SupabaseClient, roomId: string) {
  return supabase
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("room_id", roomId)
    .is("left_at", null)
    .order("joined_at")
    .overrideTypes<Player[], { merge: false }>();
}

export async function updateRoomStatus(
  supabase: SupabaseClient,
  roomId: string,
  status: string
) {
  return supabase
    .from("rooms")
    .update({ status })
    .eq("id", roomId)
    .select("id, code, host_id, status, settings, created_at")
    .single<Room>();
}

export type Round = {
  id: string;
  room_id: string;
  round_number: number;
  drawer_id: string;
  status: string;
  started_at: string | null;
  ends_at: string | null;
  word_length: number | null;
};

const ROUND_COLUMNS =
  "id, room_id, round_number, drawer_id, status, started_at, ends_at, word_length";

export async function createRound(
  supabase: SupabaseClient,
  params: { roomId: string; roundNumber: number; drawerId: string }
) {
  return supabase
    .from("rounds")
    .insert({
      room_id: params.roomId,
      round_number: params.roundNumber,
      drawer_id: params.drawerId,
      status: "choosing",
    })
    .select(ROUND_COLUMNS)
    .single<Round>();
}

export async function deleteRound(supabase: SupabaseClient, roundId: string) {
  return supabase.from("rounds").delete().eq("id", roundId);
}

export async function getCurrentRound(supabase: SupabaseClient, roomId: string) {
  return supabase
    .from("rounds")
    .select(ROUND_COLUMNS)
    .eq("room_id", roomId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle<Round>();
}

// Slaat het gekozen woord op in round_words (nooit rechtstreeks leesbaar
// door gokkers) en zet de ronde daarna op 'drawing' met word_length +
// start-/eindtijd. Twee losse writes zonder DB-transactie — bij een
// mislukte tweede write wordt de eerste best-effort teruggedraaid.
export async function chooseRoundWord(
  supabase: SupabaseClient,
  params: { roundId: string; word: string; durationSeconds: number }
) {
  const { error: wordError } = await supabase
    .from("round_words")
    .insert({ round_id: params.roundId, word: params.word });

  if (wordError) {
    return { data: null, error: wordError };
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + params.durationSeconds * 1000);

  const { data, error } = await supabase
    .from("rounds")
    .update({
      word_length: params.word.length,
      status: "drawing",
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .eq("id", params.roundId)
    .select(ROUND_COLUMNS)
    .single<Round>();

  if (error) {
    await supabase.from("round_words").delete().eq("round_id", params.roundId);
    return { data: null, error };
  }

  return { data, error: null };
}

// Alleen de tekenaar van de ronde mag dit (RLS-policy "drawer updates own
// round"); wordt aangeroepen door de tekenaar-client zodra rounds.ends_at
// verstreken is.
export async function revealRound(supabase: SupabaseClient, roundId: string) {
  return supabase
    .from("rounds")
    .update({ status: "reveal" })
    .eq("id", roundId)
    .select(ROUND_COLUMNS)
    .single<Round>();
}

// Het woord zelf (guess_text) wordt hier bewust niet opgevraagd — deze
// lijst wordt gebruikt om per speler de scoretoename van de ronde te
// berekenen, niet om de gok-inhoud te tonen.
export type RoundGuess = {
  id: string;
  round_id: string;
  player_id: string;
  correct: boolean;
  points_awarded: number;
  guessed_at: string;
};

const ROUND_GUESS_COLUMNS =
  "id, round_id, player_id, correct, points_awarded, guessed_at";

export async function listRoundGuesses(
  supabase: SupabaseClient,
  roundId: string
) {
  return supabase
    .from("guesses")
    .select(ROUND_GUESS_COLUMNS)
    .eq("round_id", roundId)
    .order("guessed_at", { ascending: true })
    .overrideTypes<RoundGuess[], { merge: false }>();
}

// Zet een afgelopen spel terug naar een verse lobby: rounds verwijderen
// cascadeert automatisch naar round_words, maar guesses heeft een eigen FK
// naar rounds zonder cascade — die moeten dus eerst expliciet weg, anders
// faalt het verwijderen van rounds op die foreign key.
export async function restartGame(supabase: SupabaseClient, roomId: string) {
  const { data: rounds, error: roundsError } = await supabase
    .from("rounds")
    .select("id")
    .eq("room_id", roomId);

  if (roundsError) {
    return { error: roundsError };
  }

  const roundIds = (rounds ?? []).map((round) => (round as { id: string }).id);

  if (roundIds.length > 0) {
    const { error: guessesError } = await supabase
      .from("guesses")
      .delete()
      .in("round_id", roundIds);

    if (guessesError) {
      return { error: guessesError };
    }

    const { error: deleteRoundsError } = await supabase
      .from("rounds")
      .delete()
      .in("id", roundIds);

    if (deleteRoundsError) {
      return { error: deleteRoundsError };
    }
  }

  const { error: scoreError } = await supabase
    .from("players")
    .update({ score: 0 })
    .eq("room_id", roomId);

  if (scoreError) {
    return { error: scoreError };
  }

  const { error: statusError } = await supabase
    .from("rooms")
    .update({ status: "lobby" })
    .eq("id", roomId);

  return { error: statusError };
}
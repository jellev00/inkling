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
};

const PLAYER_COLUMNS =
  "id, room_id, auth_user_id, name, avatar_color, score, is_host, connected, joined_at";

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
    .eq("room_id", roomId);
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

export async function listPlayers(supabase: SupabaseClient, roomId: string) {
  return supabase
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("room_id", roomId)
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
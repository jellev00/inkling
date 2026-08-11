// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Alleen POST toegestaan." }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Authorization header ontbreekt." }, 401);
  }

  let round_id: string | undefined;
  try {
    ({ round_id } = await req.json());
  } catch {
    return jsonResponse({ error: "Ongeldige request body." }, 400);
  }

  if (!round_id) {
    return jsonResponse({ error: "round_id is verplicht." }, 400);
  }

  // Service role client: omzeilt RLS, dus alle autorisatie hieronder
  // gebeurt expliciet in code — er is geen policy die dit afdekt.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await supabase.auth.getUser(
    jwt
  );

  if (authError || !authData.user) {
    return jsonResponse({ error: "Ongeldige of verlopen sessie." }, 401);
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, room_id, status")
    .eq("id", round_id)
    .single();

  if (roundError || !round) {
    return jsonResponse({ error: "Ronde niet gevonden." }, 404);
  }

  // Het woord is pas publiek zodra de ronde voorbij is — anders zou dit
  // endpoint hetzelfde lek zijn als rechtstreeks round_words uitlezen.
  if (round.status !== "reveal") {
    return jsonResponse(
      { error: "Het woord is nog niet vrijgegeven voor deze ronde." },
      403
    );
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("room_id", round.room_id)
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (playerError || !player) {
    return jsonResponse(
      { error: "Je bent geen speler in deze room." },
      403
    );
  }

  const { data: roundWord, error: roundWordError } = await supabase
    .from("round_words")
    .select("word")
    .eq("round_id", round_id)
    .single();

  if (roundWordError || !roundWord) {
    return jsonResponse({ error: "Woord niet gevonden voor deze ronde." }, 404);
  }

  return jsonResponse({ word: (roundWord as { word: string }).word });
});

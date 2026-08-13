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

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

  // Wie roept dit aan? Verifieer de meegegeven JWT van de aanroeper zelf.
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await supabase.auth.getUser(
    jwt
  );

  if (authError || !authData.user) {
    return jsonResponse({ error: "Ongeldige of verlopen sessie." }, 401);
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, room_id, drawer_id")
    .eq("id", round_id)
    .single();

  if (roundError || !round) {
    return jsonResponse({ error: "Ronde niet gevonden." }, 404);
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, settings")
    .eq("id", round.room_id)
    .single();

  if (roomError || !room) {
    return jsonResponse({ error: "Room niet gevonden." }, 404);
  }

  const { data: drawer, error: drawerError } = await supabase
    .from("players")
    .select("id, auth_user_id")
    .eq("id", round.drawer_id)
    .single();

  if (drawerError || !drawer) {
    return jsonResponse({ error: "Tekenaar niet gevonden." }, 404);
  }

  // Enige echte autorisatiecheck: alleen de tekenaar van déze ronde mag
  // woordkeuzes opvragen (voorkomt lekken naar gokkers via devtools).
  if (drawer.auth_user_id !== authData.user.id) {
    return jsonResponse(
      { error: "Alleen de tekenaar van deze ronde mag woordkeuzes opvragen." },
      403
    );
  }

  const category =
    (room.settings as { category?: string } | null)?.category ?? "Algemeen";

  // round_words gekoppeld aan rounds waar rounds.room_id de room van deze
  // ronde is — alle woorden die deze room in eerdere rondes al gebruikt
  // heeft, mogen niet opnieuw als keuze verschijnen.
  const { data: usedWordRows, error: usedWordsError } = await supabase
    .from("round_words")
    .select("word, rounds!inner(room_id)")
    .eq("rounds.room_id", round.room_id);

  if (usedWordsError) {
    return jsonResponse(
      { error: "Kon eerder gebruikte woorden niet ophalen." },
      500
    );
  }

  const usedWords = (usedWordRows ?? []).map(
    (row) => (row as { word: string }).word
  );

  let wordsQuery = supabase.from("words").select("word").eq("category", category);

  if (usedWords.length > 0) {
    wordsQuery = wordsQuery.not(
      "word",
      "in",
      `(${usedWords.map((word) => JSON.stringify(word)).join(",")})`
    );
  }

  const { data: words, error: wordsError } = await wordsQuery;

  if (wordsError) {
    return jsonResponse({ error: "Kon geen woorden ophalen." }, 500);
  }

  const choices = shuffle((words ?? []).map((row) => row.word)).slice(0, 3);

  return jsonResponse(choices);
});
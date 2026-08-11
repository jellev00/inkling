// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_POINTS = 100;
const MIN_POINTS = 20;
const DRAWER_BONUS_POINTS = 5;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Lineair aftellend vanaf MAX_POINTS bij 0 sec naar MIN_POINTS aan het
// einde van de rondetijd — sneller raden levert dus meer punten op.
function calculatePoints(
  startedAt: string,
  endsAt: string,
  now: number
): number {
  const startedMs = new Date(startedAt).getTime();
  const endsMs = new Date(endsAt).getTime();
  const durationMs = Math.max(endsMs - startedMs, 1);
  const elapsedMs = Math.min(Math.max(now - startedMs, 0), durationMs);
  const fraction = elapsedMs / durationMs;

  const points = MAX_POINTS - (MAX_POINTS - MIN_POINTS) * fraction;
  return Math.round(Math.min(Math.max(points, MIN_POINTS), MAX_POINTS));
}

// Geen DB-transactie beschikbaar in deze setup — zelfde niet-atomaire
// read-then-write-aanpak als chooseRoundWord() elders in het project.
async function addToScore(
  supabase: ReturnType<typeof createClient>,
  playerId: string,
  delta: number
) {
  const { data: player, error: readError } = await supabase
    .from("players")
    .select("score")
    .eq("id", playerId)
    .single();

  if (readError || !player) {
    return { error: readError ?? new Error("Speler niet gevonden.") };
  }

  const { error: writeError } = await supabase
    .from("players")
    .update({ score: (player as { score: number }).score + delta })
    .eq("id", playerId);

  return { error: writeError };
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
  let guess_text: string | undefined;
  try {
    ({ round_id, guess_text } = await req.json());
  } catch {
    return jsonResponse({ error: "Ongeldige request body." }, 400);
  }

  if (!round_id || !guess_text || !guess_text.trim()) {
    return jsonResponse(
      { error: "round_id en guess_text zijn verplicht." },
      400
    );
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
    .select("id, room_id, drawer_id, status, started_at, ends_at")
    .eq("id", round_id)
    .single();

  if (roundError || !round) {
    return jsonResponse({ error: "Ronde niet gevonden." }, 404);
  }

  if (round.status !== "drawing" || !round.started_at || !round.ends_at) {
    return jsonResponse(
      { error: "Deze ronde accepteert nu geen gokken." },
      400
    );
  }

  // Het ronde-woord opzoeken en de drawer-check (die zelf een player-fetch
  // vereist) hangen niet van elkaar af — parallel ophalen scheelt een
  // volledige netwerk-roundtrip t.o.v. na elkaar.
  const [roundWordResult, playerResult] = await Promise.all([
    supabase.from("round_words").select("word").eq("round_id", round_id).single(),
    supabase
      .from("players")
      .select("id, name")
      .eq("room_id", round.room_id)
      .eq("auth_user_id", authData.user.id)
      .maybeSingle(),
  ]);

  const { data: roundWord, error: roundWordError } = roundWordResult;
  const { data: player, error: playerError } = playerResult;

  if (playerError || !player) {
    return jsonResponse(
      { error: "Je bent geen speler in deze room." },
      403
    );
  }

  // De tekenaar hoort het eigen woord niet te kunnen "raden".
  if (player.id === round.drawer_id) {
    return jsonResponse(
      { error: "De tekenaar kan niet meegokken in de eigen ronde." },
      403
    );
  }

  if (roundWordError || !roundWord) {
    return jsonResponse({ error: "Woord niet gevonden voor deze ronde." }, 404);
  }

  const trimmedGuess = guess_text.trim();
  const correct =
    trimmedGuess.toLowerCase() ===
    (roundWord as { word: string }).word.trim().toLowerCase();

  const chatChannel = supabase.channel(`round-${round_id}-chat`);

  if (correct) {
    const points = calculatePoints(round.started_at, round.ends_at, Date.now());

    // De broadcast bepaalt de live-ervaring van alle spelers, dus die gaat
    // als eerste uit zodra correct/incorrect vaststaat. De guesses-rij en
    // de score-writes hieronder gebeuren pas erna, in de achtergrond — de
    // response (en dus de UX) hoeft niet op die DB-writes te wachten.
    // Nooit het woord zelf meesturen — enkel dat er correct geraden werd.
    await chatChannel.send({
      type: "broadcast",
      event: "guess",
      payload: { playerName: player.name, correct: true },
    });

    EdgeRuntime.waitUntil(
      (async () => {
        const { error: guessError } = await supabase.from("guesses").insert({
          round_id,
          player_id: player.id,
          guess_text: trimmedGuess,
          correct: true,
          points_awarded: points,
        });
        if (guessError) {
          console.error("Kon guess niet opslaan:", guessError);
        }

        const { error: scoreError } = await addToScore(
          supabase,
          player.id,
          points
        );
        if (scoreError) {
          console.error("Kon score van gokker niet bijwerken:", scoreError);
        }

        // Best-effort: de tekenaar krijgt een klein bonuspunt per correcte
        // gok. Fouten hierin mogen de rest niet blokkeren.
        const { error: bonusError } = await addToScore(
          supabase,
          round.drawer_id,
          DRAWER_BONUS_POINTS
        );
        if (bonusError) {
          console.error("Kon bonus van tekenaar niet bijwerken:", bonusError);
        }
      })()
    );

    return jsonResponse({ correct: true, points });
  }

  // Fout geraden lekt niets, dus het gokwoord zelf mag mee in de broadcast.
  // Ook hier: broadcast eerst, de guesses-rij erna in de achtergrond.
  await chatChannel.send({
    type: "broadcast",
    event: "guess",
    payload: { playerName: player.name, correct: false, text: trimmedGuess },
  });

  EdgeRuntime.waitUntil(
    (async () => {
      const { error: guessError } = await supabase.from("guesses").insert({
        round_id,
        player_id: player.id,
        guess_text: trimmedGuess,
        correct: false,
        points_awarded: 0,
      });
      if (guessError) {
        console.error("Kon guess niet opslaan:", guessError);
      }
    })()
  );

  return jsonResponse({ correct: false });
});

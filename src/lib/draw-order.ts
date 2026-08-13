import type { Player } from "@/lib/supabase/queries";

// Fisher-Yates — geeft een nieuwe array terug, muteert players niet. Wordt
// exact één keer aangeroepen, bij de allereerste 'Spel starten'-klik, en
// daarna als vaste rooms.settings.drawOrder bewaard.
export function shuffleDrawOrder(players: Player[]): string[] {
  const ids = players.map((player) => player.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

// Eerlijke rotatie over de eenmalig geschudde volgorde: garandeert dat
// iedereen precies één keer tekent vóór iemand een tweede keer aan de beurt
// komt, ongeacht het ingestelde aantal rondes.
export function getDrawerId(drawOrder: string[], roundNumber: number): string {
  return drawOrder[(roundNumber - 1) % drawOrder.length];
}

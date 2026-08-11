const MUTE_STORAGE_KEY = "inkling-muted";

const SOUND_FILES = {
  correct: "/sounds/correct.mp3",
  roundEnd: "/sounds/round-end.mp3",
} as const;

type SoundName = keyof typeof SOUND_FILES;

// Standaard AAN (niet gemute) zolang de speler de knop nog niet heeft
// gebruikt — pas na een expliciete keer dempen slaat localStorage "true" op,
// en dat wordt bij een volgend bezoek gerespecteerd.
function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(MUTE_STORAGE_KEY);
  return stored === null ? false : stored === "true";
}

function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
}

function playSound(name: SoundName): void {
  if (isMuted()) return;

  const audio = new Audio(SOUND_FILES[name]);
  // Browsers kunnen autoplay zonder voorafgaande gebruikersinteractie
  // weigeren — dat mag de rest van de app niet laten crashen.
  audio.play().catch(() => {});
}

export { MUTE_STORAGE_KEY, isMuted, setMuted, playSound };

# Inkling — project context voor Claude Code

Dit document geeft de context die bij elke sessie moet meegenomen worden: wat we bouwen, waarom, en hoe het eruit moet zien. Lees dit vóór je code schrijft of wijzigt.

## De case

Sollicitatie-opdracht voor een full service marketingbureau. Opdracht: bouw een browsergame voor meerdere spelers waarbij één speler per ronde een woord tekent en de rest via chat meeraadt terwijl de tekening live ontstaat. Sneller raden = meer punten. Meerdere rondes, iedereen tekent één keer, eindstand op het einde.

**Beoordelingscriteria van de opdrachtgever** (in volgorde van wat zij benadrukken):

1. Techniek — multiplayer, realtime tekenen en chat moeten betrouwbaar werken
2. UX/UI — professionele uitstraling
3. Design — duidelijke identiteit, animaties, states, responsive
4. Productdenken — volledige flow lobby → game → ronde → score → eindstand
5. Codekwaliteit — architectuur en keuzes moeten beargumenteerd zijn in de repo-toelichting

**Expliciete instructie van de opdrachtgever:** "iets dat werkt maar er niet uitziet, is bij ons maar half af." Styling en polish zijn dus geen nice-to-have, maar een hard beoordelingscriterium naast de techniek.

**Eigen doel:** small scope, high quality, beautiful execution. Liever minder features die perfect afgewerkt zijn dan veel features die half af zijn.

## Tech stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Animaties:** Framer Motion
- **Backend/realtime:** Supabase (PostgreSQL, Realtime, Edge Functions, Anonymous Auth)
- **Deployment:** Vercel

## Designsysteem

### Kleuren

Definieer deze als CSS-variabelen / Tailwind theme-kleuren, niet als losse hex-waarden in components.

**Basis**
| Naam | Hex | Gebruik |
|---|---|---|
| `canvas` | `#FAFAF8` | achtergrond |
| `ink` | `#18181B` | tekst, lijnen |
| `white` | `#FFFFFF` | kaarten, invoervelden |
| `neutral` | `#B4B2A9` | borders, secundaire elementen |

**Merk & status**
| Naam | Hex | Gebruik |
|---|---|---|
| `primary` | `#7C5CFC` | logo, primaire knoppen, actieve staat |
| `energy` | `#FF6B5C` | timer, urgentie |
| `success` | `#22C55E` | correcte gok, bevestiging |
| `error` | `#F43F5E` | fouten, disconnect |

**Spelerskleuren** (avatar-achtergronden, 6 vaste tinten, roulerend toegewezen bij join)
| Naam | Hex |
|---|---|
| Oranje | `#FF6B5C` |
| Paars | `#7C5CFC` |
| Groen | `#22C55E` |
| Blauw | `#347CD4` |
| Geel | `#EC9634` |
| Roze | `#F43F5E` |

### Typography

- **Inter** (Regular & Bold) — alle UI en body-tekst: knoppen, chat, spelerslijst, formulieren
- **Caveat** (Regular & Bold) — spaarzaam voor speelse/handschrift-momenten: logo-wordmark, het woord-met-blanks, "jij bent aan de beurt!"

Vuistregel: interactie → Inter. Moment (score, beurt, winnaar) → Caveat.

### Iconen

Lokale SVG's, te vinden in `public/icons/`. Kopieer ze daar vóór je begint met bouwen — verwijs in code naar dat pad, gebruik geen extern icon-pakket voor iconen die al als SVG aanwezig zijn.

## Datamodel (Supabase)

```
rooms      → id, code, host_id, status, settings (jsonb), created_at
players    → id, room_id, name, avatar_color, score, is_host, connected, joined_at
rounds     → id, room_id, round_number, drawer_id, word, status, started_at, ends_at
guesses    → id, round_id, player_id, guess_text, correct, points_awarded, guessed_at
drawings   → id, round_id, snapshot_svg   (optioneel, voor eindgalerij)
```

Belangrijk: `rounds.word` mag via Row Level Security alleen leesbaar zijn voor de speler wiens `id` gelijk is aan `drawer_id` van die ronde. Dit is functioneel, geen nice-to-have — voorkom dat het woord via de browser devtools uitlekt naar gokkers.

## Realtime-architectuur

Drie aparte Supabase Realtime-mechanismen, elk voor hun eigen taak:

| Mechanisme       | Voor                              | Waarom                                                      |
| ---------------- | --------------------------------- | ----------------------------------------------------------- |
| Broadcast        | live tekenstrokes                 | laagste latency, geen DB-schrijflast, strokes zijn vluchtig |
| Presence         | wie is online, player joined/left | ingebouwd, geen polling                                     |
| Postgres Changes | scores, ronde-status              | moet consistent/betrouwbaar zijn, DB is bron van waarheid   |

Scoring wordt server-side berekend (Edge Function), nooit client-side — anders kan een gemanipuleerde client zichzelf punten toekennen.

## Wat wél, wat bewust niet (v1)

**Wel:** room-codes, live tekenen, chat-gokken, snelheidsscoring, volledige rondecyclus, eindstand, avatars, animaties, geluid met mute, responsive tot tablet.

**Bewust niet:** custom woordenlijsten door spelers, teams/co-op, permanente accounts, spectator-modus, replay-galerij (datamodel laat dit later wel toe via de `drawings`-tabel).

## Werkwijze binnen dit project

- Bouw component-first: herbruikbare stukken (avatar, roomcode-badge, score-rij, kaart) eerst, dan pas de schermen die ze combineren.
- Bij twijfel over een designdetail: raadpleeg de screenshots in `design/` (Figma-export) vóór je iets verzint.
- Elke nieuwe Tailwind-kleur of font die niet in dit document staat, eerst hier toevoegen vóór gebruik in code — geen losse hex-waarden in components.

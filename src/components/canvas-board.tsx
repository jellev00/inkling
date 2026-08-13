"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { Icon } from "@/components/icon";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const DRAW_COLORS = [
  { name: "Zwart", value: "#18181B" },
  { name: "Paars", value: "#7C5CFC" },
  { name: "Koraal", value: "#FF6B5C" },
  { name: "Groen", value: "#22C55E" },
];

const ERASER_COLOR = "#FFFFFF";

// Strokes zijn vluchtig en tijdgevoelig, dus max 1 broadcast per 30ms —
// vaker heeft geen merkbaar effect op de raders maar wel op de kanaallast.
// De muis genereert in die 30ms vaak meerdere pointermove-events; die
// tussenliggende punten worden verzameld en in één keer meegestuurd, in
// plaats van dat alleen het laatste punt de rest laat verdwijnen.
const BROADCAST_THROTTLE_MS = 30;

type Point = { x: number; y: number };

// points is genormaliseerd (0-1 t.o.v. canvas-breedte/hoogte), niet in
// pixels — tekenaar en raders kunnen een canvas met een andere pixelgrootte
// hebben (responsive layout), alleen de aspect-ratio ligt vast. strokeId
// identificeert één ononderbroken pointer-down-tot-up beweging, zodat
// raders opeenvolgende broadcasts van diezelfde lijn aan elkaar kunnen
// knopen zonder ze per ongeluk te verbinden met een andere, losse lijn.
type StrokePayload = {
  strokeId: string;
  points: Point[];
  color: string;
  lineWidth: number;
};

// points hier zijn ook genormaliseerd (0-1), net als in StrokePayload — dit
// is de volledige tekening tot nu toe (eigen strokes én ontvangen strokes),
// bewaard zodat een resize het canvas kan herbouwen i.p.v. te vertrouwen op
// rauwe pixels die bij een canvas.width/height-wijziging verloren gaan.
type Stroke = {
  points: Point[];
  color: string;
  lineWidth: number;
};

const RESIZE_DEBOUNCE_MS = 150;

function CanvasBoard({
  interactive,
  roundId,
  className,
}: {
  interactive: boolean;
  roundId: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);

  // Enige bron van waarheid voor "waar eindigde de lijn tot nu toe" bij de
  // tekenaar — zowel het eigen canvas als elke broadcast vertrekken hier
  // vanaf, nooit vanaf het startpunt van het losse pointer-event zelf.
  const lastPointRef = useRef<Point | null>(null);
  const strokeIdRef = useRef<string | null>(null);
  const pendingPointsRef = useRef<Point[]>([]);
  const pendingStyleRef = useRef<{ color: string; lineWidth: number } | null>(
    null
  );
  const lastBroadcastAtRef = useRef(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  // Laatst ontvangen punt per stroke bij de raders, om opeenvolgende
  // broadcasts van dezelfde lijn zonder gat aan elkaar te knopen.
  const remoteStrokeRef = useRef<{ strokeId: string; point: Point } | null>(
    null
  );

  // Alle strokes tot nu toe (per strokeId), zowel zelf getekend als
  // ontvangen — enige bron van waarheid om het canvas na een resize
  // opnieuw op te bouwen.
  const allStrokesRef = useRef<Map<string, Stroke>>(new Map());
  const currentStrokeRef = useRef<Stroke | null>(null);

  const [color, setColor] = useState(DRAW_COLORS[0].value);
  const [tool, setTool] = useState<"draw" | "eraser">("draw");

  const strokeSegment = useCallback(
    (from: Point, to: Point, strokeColor: string, lineWidth: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    },
    []
  );

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Herbouwt het canvas volledig vanuit de bewaarde strokes-array i.p.v.
  // vanuit de rauwe canvas-pixels, die verloren gaan zodra canvas.width/
  // height wijzigt (resize/orientation change).
  const redrawStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    clearCanvas();
    for (const stroke of allStrokesRef.current.values()) {
      const { points } = stroke;
      for (let i = 1; i < points.length; i++) {
        strokeSegment(
          { x: points[i - 1].x * rect.width, y: points[i - 1].y * rect.height },
          { x: points[i].x * rect.width, y: points[i].y * rect.height },
          stroke.color,
          stroke.lineWidth
        );
      }
    }
  }, [clearCanvas, strokeSegment]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function applyResize() {
      if (!canvas || !container) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();

      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }

      redrawStrokes();
    }

    // Wordt tijdens het scrollen op mobiel (adresbalk in/uitschuiven) soms
    // meerdere keren per seconde getriggerd — debounce zodat we niet bij
    // elke tussenstap het hele canvas herbouwen.
    function scheduleResize() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(applyResize, RESIZE_DEBOUNCE_MS);
    }

    applyResize();
    window.addEventListener("resize", scheduleResize);
    window.addEventListener("orientationchange", scheduleResize);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("resize", scheduleResize);
      window.removeEventListener("orientationchange", scheduleResize);
    };
  }, [redrawStrokes]);

  const normalizePoint = useCallback((point: Point): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: point.x / rect.width, y: point.y / rect.height };
  }, []);

  const flushPendingPoints = useCallback(() => {
    const points = pendingPointsRef.current;
    const style = pendingStyleRef.current;
    if (points.length === 0 || !style || !strokeIdRef.current) return;

    channelRef.current?.send({
      type: "broadcast",
      event: "stroke",
      payload: {
        strokeId: strokeIdRef.current,
        points,
        color: style.color,
        lineWidth: style.lineWidth,
      } satisfies StrokePayload,
    });

    pendingPointsRef.current = [];
  }, []);

  // Live tekensynchronisatie via Broadcast (niet de DB): laagste latency,
  // geen schrijflast, en strokes hoeven nergens bewaard te blijven.
  // De tekenaar stuurt strokes, raders luisteren en tekenen ze na op hun
  // eigen canvas.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`round-${roundId}-strokes`, {
      config: { broadcast: { self: false } },
    });

    if (!interactive) {
      channel
        .on("broadcast", { event: "stroke" }, ({ payload }) => {
          const stroke = payload as StrokePayload;
          const canvas = canvasRef.current;
          if (!canvas || stroke.points.length === 0) return;
          const rect = canvas.getBoundingClientRect();
          const toPixel = (p: Point): Point => ({
            x: p.x * rect.width,
            y: p.y * rect.height,
          });

          const previous = remoteStrokeRef.current;
          const continuesStroke = previous?.strokeId === stroke.strokeId;

          // Knoop deze batch vast aan het eindpunt van de vorige batch van
          // dezelfde stroke, zodat er geen gat ontstaat tussen broadcasts.
          // Bij een nieuwe stroke is het eerste punt zelf het ankerpunt.
          const chain = continuesStroke
            ? [previous!.point, ...stroke.points]
            : stroke.points;

          for (let i = 1; i < chain.length; i++) {
            strokeSegment(
              toPixel(chain[i - 1]),
              toPixel(chain[i]),
              stroke.color,
              stroke.lineWidth
            );
          }

          remoteStrokeRef.current = {
            strokeId: stroke.strokeId,
            point: stroke.points[stroke.points.length - 1],
          };

          // Bewaar de punten ook genormaliseerd, zodat een resize dit
          // canvas later opnieuw kan opbouwen zonder de tekenaar opnieuw
          // te hoeven laten uitzenden.
          const existing = allStrokesRef.current.get(stroke.strokeId);
          if (existing) {
            existing.points.push(...stroke.points);
            existing.color = stroke.color;
            existing.lineWidth = stroke.lineWidth;
          } else {
            allStrokesRef.current.set(stroke.strokeId, {
              points: [...stroke.points],
              color: stroke.color,
              lineWidth: stroke.lineWidth,
            });
          }
        })
        .on("broadcast", { event: "clear" }, () => {
          clearCanvas();
          allStrokesRef.current.clear();
          remoteStrokeRef.current = null;
        });
    }

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roundId, interactive, strokeSegment, clearCanvas]);

  function getPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!interactive) return;
    const point = getPoint(event);
    if (!point) return;

    drawingRef.current = true;
    lastPointRef.current = point;
    strokeIdRef.current = crypto.randomUUID();

    const normalized = normalizePoint(point);
    // Zaai de batch met het startpunt, zodat de raders bij de eerste
    // broadcast van deze stroke weten waar de lijn moet beginnen.
    pendingPointsRef.current = normalized ? [normalized] : [];
    pendingStyleRef.current = null;
    lastBroadcastAtRef.current = performance.now();

    const strokeColor = tool === "eraser" ? ERASER_COLOR : color;
    const lineWidth = tool === "eraser" ? 18 : 4;
    const stroke: Stroke = {
      points: normalized ? [normalized] : [],
      color: strokeColor,
      lineWidth,
    };
    currentStrokeRef.current = stroke;
    allStrokesRef.current.set(strokeIdRef.current, stroke);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!interactive || !drawingRef.current) return;

    const point = getPoint(event);
    const last = lastPointRef.current;
    if (!point || !last) return;

    const strokeColor = tool === "eraser" ? ERASER_COLOR : color;
    const lineWidth = tool === "eraser" ? 18 : 4;

    strokeSegment(last, point, strokeColor, lineWidth);
    lastPointRef.current = point;

    const normalized = normalizePoint(point);
    if (normalized) {
      pendingPointsRef.current.push(normalized);
      pendingStyleRef.current = { color: strokeColor, lineWidth };

      if (currentStrokeRef.current) {
        currentStrokeRef.current.points.push(normalized);
        currentStrokeRef.current.color = strokeColor;
        currentStrokeRef.current.lineWidth = lineWidth;
      }
    }

    const now = performance.now();
    if (now - lastBroadcastAtRef.current >= BROADCAST_THROTTLE_MS) {
      lastBroadcastAtRef.current = now;
      flushPendingPoints();
    }
  }

  function handlePointerUp() {
    // Stuur de laatste, nog niet uitgezonden punten meteen door — anders
    // mist het staartje van de lijn bij de raders tot wel 30ms aan tekenwerk.
    flushPendingPoints();

    drawingRef.current = false;
    lastPointRef.current = null;
    strokeIdRef.current = null;
    pendingPointsRef.current = [];
    pendingStyleRef.current = null;
    currentStrokeRef.current = null;
  }

  function handleClear() {
    clearCanvas();
    allStrokesRef.current.clear();
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        ref={containerRef}
        className="aspect-4/3 w-full overflow-hidden rounded-2xl border border-neutral/30 bg-white lg:aspect-auto lg:h-125"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={interactive ? "touch-none cursor-crosshair" : ""}
        />
      </div>

      {interactive && (
        <div className="flex items-center justify-between">
          <div className="flex gap-2.5">
            {DRAW_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={c.name}
                onClick={() => {
                  setColor(c.value);
                  setTool("draw");
                }}
                className={cn(
                  "size-8 rounded-full transition-all",
                  tool === "draw" &&
                    color === c.value &&
                    "ring-2 ring-ink ring-offset-2 ring-offset-canvas"
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Gum"
              onClick={() => setTool("eraser")}
              className={cn(
                "transition-colors",
                tool === "eraser" ? "text-ink" : "text-neutral hover:text-ink"
              )}
            >
              <Icon name="eraser" className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Alles wissen"
              onClick={handleClear}
              className="text-neutral transition-colors hover:text-error"
            >
              <Icon name="trash-can" className="size-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { CanvasBoard };

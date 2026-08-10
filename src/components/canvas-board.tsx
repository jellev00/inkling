"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

const DRAW_COLORS = [
  { name: "Zwart", value: "#18181B" },
  { name: "Paars", value: "#7C5CFC" },
  { name: "Koraal", value: "#FF6B5C" },
  { name: "Groen", value: "#22C55E" },
];

const ERASER_COLOR = "#FFFFFF";

function CanvasBoard({
  interactive,
  className,
}: {
  interactive: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const [color, setColor] = useState(DRAW_COLORS[0].value);
  const [tool, setTool] = useState<"draw" | "eraser">("draw");

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    function resize() {
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

    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

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
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!interactive || !drawingRef.current) return;

    const ctx = canvasRef.current?.getContext("2d");
    const point = getPoint(event);
    const last = lastPointRef.current;
    if (!ctx || !point || !last) return;

    ctx.strokeStyle = tool === "eraser" ? ERASER_COLOR : color;
    ctx.lineWidth = tool === "eraser" ? 18 : 4;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    lastPointRef.current = point;
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        ref={containerRef}
        className="aspect-4/3 w-full overflow-hidden rounded-2xl border border-neutral/30 bg-white"
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

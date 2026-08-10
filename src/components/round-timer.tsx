"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function RoundTimer({
  endsAt,
  className,
}: {
  endsAt: string | null;
  className?: string;
}) {
  const [remainingMs, setRemainingMs] = useState(() =>
    endsAt ? new Date(endsAt).getTime() - Date.now() : 0
  );

  useEffect(() => {
    if (!endsAt) return;

    const end = new Date(endsAt).getTime();
    const tick = () => setRemainingMs(end - Date.now());

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full bg-energy/15 px-3 py-1 text-sm font-medium text-energy",
        className
      )}
    >
      <Icon name="clock" className="size-3.5" />
      {formatRemaining(remainingMs)}
    </span>
  );
}

export { RoundTimer };

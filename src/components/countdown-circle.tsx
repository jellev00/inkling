"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// Puur visueel: telt lokaal af vanaf `seconds`, zonder eigen callback bij
// het einde. Schermen die hier iets aan moeten koppelen (bv. automatisch
// doorschakelen) houden hun eigen timer van dezelfde duur bij.
function CountdownCircle({
  seconds,
  className,
}: {
  seconds: number;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [remaining]);

  return (
    <div
      className={cn(
        "flex size-48 items-center justify-center rounded-full border-2 border-primary bg-primary/15",
        className
      )}
    >
      <span className="text-7xl font-bold text-primary">{remaining}</span>
    </div>
  );
}

export { CountdownCircle };

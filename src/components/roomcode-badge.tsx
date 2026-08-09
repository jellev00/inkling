"use client";

import { useState } from "react";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function useCopyCode(code: string) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return { copied, copy };
}

function RoomcodeCard({
  code,
  label = "Roomcode",
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const { copied, copy } = useCopyCode(code);

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-2xl bg-primary/10 px-6 py-5",
        className
      )}
    >
      <div>
        <p className="text-sm text-ink/60">{label}</p>
        <p className="font-sans text-3xl font-bold tracking-wide text-ink">
          {code}
        </p>
      </div>
      <Button variant="outline" onClick={copy}>
        <Icon name={copied ? "check" : "copy"} className="size-3.5" />
        {copied ? "Gekopieerd" : "Kopieer code"}
      </Button>
    </div>
  );
}

function RoomcodeCompact({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const { copied, copy } = useCopyCode(code);

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 font-sans text-sm font-bold tracking-wide text-ink transition-colors hover:bg-primary/15",
        className
      )}
    >
      {code}
      <Icon name={copied ? "check" : "copy"} className="size-3.5" />
    </button>
  );
}

export { RoomcodeCard, RoomcodeCompact };
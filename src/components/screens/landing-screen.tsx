"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Icon } from "@/components/icon";
import { Squiggle } from "@/components/squiggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LandingScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();

    if (trimmed.length !== 4) {
      setError("Voer een geldige 4-karakter roomcode in.");
      return;
    }

    setError(null);
    router.push(`/join/${trimmed}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-20 bg-canvas px-6 py-16">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="font-caveat text-7xl font-bold text-primary">
          Inkling
        </h1>
        <p className="text-lg text-ink/70">Draw fast. guess faster</p>
        <Squiggle
          className="mt-16 w-full pl-8"
          strokeClassName="stroke-ink"
          dotClassName="fill-energy"
        />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button
          size="lg"
          className="h-14 w-full rounded-xl text-base"
          onClick={() => router.push("/new")}
        >
          <Icon name="play" className="size-4" />
          Spel starten
        </Button>

        <form onSubmit={handleJoin} className="flex gap-2">
          <Input
            value={code}
            onChange={(event) => {
              setError(null);
              setCode(event.target.value.toUpperCase().slice(0, 4));
            }}
            placeholder="Roomcode, bv. X7KD"
            className="h-12 flex-1 rounded-xl border-none bg-ink px-4 uppercase tracking-widest text-white placeholder:text-white/40 placeholder:tracking-normal placeholder:normal-case"
          />
          <Button type="submit" variant="outline" className="h-12 rounded-xl px-5">
            Joinen
          </Button>
        </form>

        {error && <p className="text-center text-sm text-error">{error}</p>}

        <p className="mt-6 text-center text-sm text-neutral">
          Geen account nodig — je bent binnen 10 seconden aan het spelen
        </p>
      </div>
    </div>
  );
}

export { LandingScreen };
function WordSlots({ letters }: { letters: (string | null)[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {letters.map((letter, index) => (
        <span
          key={index}
          className="flex h-8 w-5 items-end justify-center border-b-2 border-neutral/50 pb-1 text-xl font-bold uppercase text-ink/70"
        >
          {letter ?? ""}
        </span>
      ))}
      <span className="ml-2 self-end pb-1 text-sm font-normal text-neutral">
        ({letters.length})
      </span>
    </div>
  );
}

export { WordSlots };

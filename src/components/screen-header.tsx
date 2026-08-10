import Link from "next/link";

import { Icon } from "@/components/icon";

function ScreenHeader({ href = "/" }: { href?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Link
        href={href}
        aria-label="Terug"
        className="text-neutral transition-colors hover:text-ink"
      >
        <Icon name="arrow-left" className="size-4" />
      </Link>
      <span className="font-caveat text-2xl font-bold text-primary">
        Inkling
      </span>
    </div>
  );
}

export { ScreenHeader };
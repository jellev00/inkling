import type * as React from "react";

import { cn } from "@/lib/utils";

function SectionLabel({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-neutral", className)} {...props} />;
}

export { SectionLabel };
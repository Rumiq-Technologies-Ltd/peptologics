import type { ElementType, ReactNode } from "react";

import { cn } from "@/utils/cn";

/**
 * Horizontal content bounds. One place, so no page invents its own max width and
 * content never stretches edge-to-edge on a large monitor.
 */
export function Container({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</Tag>
  );
}

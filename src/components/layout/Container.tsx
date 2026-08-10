import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

/**
 * Horizontal content bounds. One place, so no page invents its own max width and
 * content never stretches edge-to-edge on a large monitor.
 *
 * `as` is a fixed union rather than `ElementType`, and has to be. `@react-three/fiber`
 * augments `JSX.IntrinsicElements` with every three.js element globally, several of
 * which type `children` as `never` — which made `ElementType` here resolve its children
 * to `never` too, and this file stopped compiling the moment the 3D hero landed. The
 * union is also simply more honest: a layout container is a handful of sectioning
 * elements, never an arbitrary component.
 */
export function Container({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside" | "header" | "footer" | "main" | "nav";
}) {
  return (
    <Tag className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</Tag>
  );
}

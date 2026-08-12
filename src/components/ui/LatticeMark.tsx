import {
  LATTICE_BONDS,
  LATTICE_CHARCOAL_BONDS,
  LATTICE_CHARCOAL_INNER,
  LATTICE_CHARCOAL_OUTER,
  LATTICE_INNER,
  LATTICE_NODES,
  LATTICE_OUTER,
} from "@/lib/brand/latticeGeometry";
import { cn } from "@/utils/cn";

/**
 * The molecular lattice glyph from the logo, hand-authored as inline SVG.
 *
 * The supplied vector logo is 42 KB of path data covering the badge, the ring and
 * the wordmark together — right for the header, wrong for a favicon, an empty
 * state, or an icon inside a heading. This is the glyph alone: a triangular
 * lattice of six nodes, three large wireframe spheres at the outer vertices and
 * three small solid nodes on the inner triangle, joined by bonds.
 *
 * The geometry lives in `latticeGeometry.ts`, shared with the generated favicon and
 * apple-touch-icon — those run through `next/og`'s Satori renderer, which cannot use
 * Tailwind classes or `currentColor`, so they re-implement this same shape with literal
 * colours. A shared geometry module is what keeps the two from drifting apart.
 *
 * Being authored rather than exported means it is tokenised (both colours are
 * props), scales without artefacts, and costs a few hundred bytes.
 *
 * Decorative by default: `aria-hidden` unless a `title` is supplied, because in
 * most placements it sits beside a text label that already names the brand.
 */
export interface LatticeMarkProps {
  className?: string;
  /** Accessible name. Omit for decorative use — the default. */
  title?: string;
}

export function LatticeMark({ className, title }: LatticeMarkProps) {
  const decorative = !title;

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-8", className)}
      fill="none"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={title}
      // currentColor for the blue elements so the mark inherits text colour and
      // works on a dark band without a second variant.
      stroke="currentColor"
    >
      {LATTICE_BONDS.map(([from, to], index) => (
        <line
          key={`bond-${from}-${to}`}
          x1={LATTICE_NODES[from]!.x}
          y1={LATTICE_NODES[from]!.y}
          x2={LATTICE_NODES[to]!.x}
          y2={LATTICE_NODES[to]!.y}
          strokeWidth={2.5}
          strokeLinecap="round"
          className={LATTICE_CHARCOAL_BONDS.has(index) ? "opacity-45" : undefined}
        />
      ))}

      {/* Outer spheres: ring plus two inner arcs, reading as a wireframe globe. */}
      {LATTICE_OUTER.map((node, index) => (
        <g
          key={`outer-${index}`}
          className={LATTICE_CHARCOAL_OUTER.has(index) ? "opacity-45" : undefined}
        >
          <circle cx={node.x} cy={node.y} r={8} strokeWidth={2.5} />
          <ellipse cx={node.x} cy={node.y} rx={3.4} ry={8} strokeWidth={1.5} />
          <line x1={node.x - 8} y1={node.y} x2={node.x + 8} y2={node.y} strokeWidth={1.5} />
        </g>
      ))}

      {/* Inner nodes: small rings, deliberately not filled, echoing the logo. */}
      {LATTICE_INNER.map((node, index) => (
        <circle
          key={`inner-${index}`}
          cx={node.x}
          cy={node.y}
          r={3.6}
          strokeWidth={2.5}
          className={LATTICE_CHARCOAL_INNER.has(index) ? "opacity-45" : undefined}
        />
      ))}
    </svg>
  );
}

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

/*
 * Geometry, on a 64x64 canvas.
 *
 * Outer vertices form an equilateral triangle, apex up. Inner nodes sit at the
 * midpoints of the triangle's edges, which is what produces the four-triangle
 * subdivision the logo shows.
 */
const OUTER = [
  { x: 32, y: 12 }, // apex
  { x: 14, y: 46 }, // lower left
  { x: 50, y: 46 }, // lower right
] as const;

const INNER = [
  { x: 23, y: 29 }, // apex to lower-left midpoint
  { x: 41, y: 29 }, // apex to lower-right midpoint
  { x: 32, y: 46 }, // between the lower vertices
] as const;

/** Bonds, as index pairs into [...OUTER, ...INNER]. */
const BONDS: readonly [number, number][] = [
  [0, 3],
  [0, 4],
  [1, 3],
  [2, 4],
  [1, 5],
  [2, 5],
  [3, 4],
  [3, 5],
  [4, 5],
];

const NODES = [...OUTER, ...INNER];

/**
 * The logo splits the lattice diagonally: left and upper elements are blue, right
 * and lower are charcoal. These index sets reproduce that split.
 */
const CHARCOAL_OUTER = new Set([2]);
const CHARCOAL_INNER = new Set([1, 2]);
const CHARCOAL_BONDS = new Set([3, 5, 8]);

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
      {BONDS.map(([from, to], index) => (
        <line
          key={`bond-${from}-${to}`}
          x1={NODES[from].x}
          y1={NODES[from].y}
          x2={NODES[to].x}
          y2={NODES[to].y}
          strokeWidth={2.5}
          strokeLinecap="round"
          className={CHARCOAL_BONDS.has(index) ? "opacity-45" : undefined}
        />
      ))}

      {/* Outer spheres: ring plus two inner arcs, reading as a wireframe globe. */}
      {OUTER.map((node, index) => (
        <g key={`outer-${index}`} className={CHARCOAL_OUTER.has(index) ? "opacity-45" : undefined}>
          <circle cx={node.x} cy={node.y} r={8} strokeWidth={2.5} />
          <ellipse cx={node.x} cy={node.y} rx={3.4} ry={8} strokeWidth={1.5} />
          <line x1={node.x - 8} y1={node.y} x2={node.x + 8} y2={node.y} strokeWidth={1.5} />
        </g>
      ))}

      {/* Inner nodes: small rings, deliberately not filled, echoing the logo. */}
      {INNER.map((node, index) => (
        <circle
          key={`inner-${index}`}
          cx={node.x}
          cy={node.y}
          r={3.6}
          strokeWidth={2.5}
          className={CHARCOAL_INNER.has(index) ? "opacity-45" : undefined}
        />
      ))}
    </svg>
  );
}

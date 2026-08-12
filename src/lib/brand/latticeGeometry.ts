/**
 * The molecular lattice glyph's geometry, on a 64×64 canvas.
 *
 * Pure data — no React, no styling — because it now has two renderers that must
 * agree exactly: `LatticeMark` (a real SVG element, styled with Tailwind and
 * `currentColor`) and the generated icon routes (`icon.tsx`, `apple-icon.tsx`), which
 * run through `next/og`'s Satori renderer and cannot use Tailwind classes or
 * `currentColor` — only literal inline styles. Duplicating the six-node, nine-bond
 * layout by hand in both places was how a future edit would drift them apart; a
 * shared source cannot.
 *
 * Outer vertices form an equilateral triangle, apex up. Inner nodes sit at the
 * midpoints of the triangle's edges, which is what produces the four-triangle
 * subdivision the logo shows.
 */

export interface LatticePoint {
  x: number;
  y: number;
}

export const LATTICE_OUTER: readonly LatticePoint[] = [
  { x: 32, y: 12 }, // apex
  { x: 14, y: 46 }, // lower left
  { x: 50, y: 46 }, // lower right
];

export const LATTICE_INNER: readonly LatticePoint[] = [
  { x: 23, y: 29 }, // apex to lower-left midpoint
  { x: 41, y: 29 }, // apex to lower-right midpoint
  { x: 32, y: 46 }, // between the lower vertices
];

/** Bonds, as index pairs into `[...LATTICE_OUTER, ...LATTICE_INNER]`. */
export const LATTICE_BONDS: readonly [number, number][] = [
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

export const LATTICE_NODES: readonly LatticePoint[] = [...LATTICE_OUTER, ...LATTICE_INNER];

/**
 * The logo recedes some elements rather than colouring them separately: these
 * indices render at lower opacity of the same stroke colour, which is what reads as
 * the lattice's diagonal light-to-dark sweep without needing a second colour prop.
 */
export const LATTICE_CHARCOAL_OUTER: ReadonlySet<number> = new Set([2]);
export const LATTICE_CHARCOAL_INNER: ReadonlySet<number> = new Set([1, 2]);
export const LATTICE_CHARCOAL_BONDS: ReadonlySet<number> = new Set([3, 5, 8]);

/** Opacity applied to a "receded" element. */
export const LATTICE_RECEDED_OPACITY = 0.45;

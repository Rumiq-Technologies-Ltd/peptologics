import { ImageResponse } from "next/og";

import {
  LATTICE_BONDS,
  LATTICE_CHARCOAL_BONDS,
  LATTICE_CHARCOAL_INNER,
  LATTICE_CHARCOAL_OUTER,
  LATTICE_INNER,
  LATTICE_NODES,
  LATTICE_OUTER,
  LATTICE_RECEDED_OPACITY,
} from "@/lib/brand/latticeGeometry";

/**
 * Favicon.
 *
 * The client's molecular lattice mark, not a monogram. A "P" tile was the original
 * placeholder before the client supplied their actual mark; now that `LatticeMark`
 * exists as the sanctioned small-scale rendering of it, the favicon should be that
 * mark rather than a different symbol invented for this one spot.
 *
 * Hand-rendered SVG rather than `<LatticeMark />` itself: this route runs through
 * `next/og`'s Satori renderer, which does not process Tailwind classes or
 * `currentColor` — only literal inline styles. The geometry is shared with that
 * component via `latticeGeometry.ts` so the two cannot drift apart; only the styling
 * layer is duplicated, because it has to be.
 *
 * White background rather than the brand-blue tile the "P" sat on: the mark's own
 * blue elements would disappear against a blue background. White is also what the
 * mark is designed for — it is how it appears in the header and, since the footer
 * moved off near-black for the same reason, everywhere else on the site.
 *
 * Note `src/app/favicon.ico` still exists and Next serves it to clients that ask for
 * `/favicon.ico` directly. This route covers the `<link rel="icon">` modern browsers
 * prefer.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Brand blue. Literal because Satori cannot read a Tailwind token or a CSS variable. */
const MARK_COLOR = "#033291";

export default async function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        borderRadius: 6,
      }}
    >
      {/*
          Solid spheres, not `LatticeMark`'s wireframe globes (a ring plus a meridian
          ellipse and an equator line per outer node). That detail reads at the ~36px+
          the component is normally used at; at a genuine 16-32px tab icon it would
          have collapsed into noise. Solid fills are also closer to how the client's
          actual photographed mark renders its spheres, so nothing about the shape
          reads as invented for this one spot.
        */}
      <svg width={26} height={26} viewBox="0 0 64 64" fill="none">
        {LATTICE_BONDS.map(([from, to], index) => (
          <line
            key={`bond-${from}-${to}`}
            x1={LATTICE_NODES[from]!.x}
            y1={LATTICE_NODES[from]!.y}
            x2={LATTICE_NODES[to]!.x}
            y2={LATTICE_NODES[to]!.y}
            stroke={MARK_COLOR}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={LATTICE_CHARCOAL_BONDS.has(index) ? LATTICE_RECEDED_OPACITY : 1}
          />
        ))}

        {LATTICE_OUTER.map((node, index) => (
          <circle
            key={`outer-${index}`}
            cx={node.x}
            cy={node.y}
            r={9}
            fill={MARK_COLOR}
            opacity={LATTICE_CHARCOAL_OUTER.has(index) ? LATTICE_RECEDED_OPACITY : 1}
          />
        ))}

        {LATTICE_INNER.map((node, index) => (
          <circle
            key={`inner-${index}`}
            cx={node.x}
            cy={node.y}
            r={4.4}
            fill={MARK_COLOR}
            opacity={LATTICE_CHARCOAL_INNER.has(index) ? LATTICE_RECEDED_OPACITY : 1}
          />
        ))}
      </svg>
    </div>,
    size,
  );
}

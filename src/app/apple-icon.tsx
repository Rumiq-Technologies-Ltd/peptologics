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
 * Home-screen icon for iOS.
 *
 * The same lattice mark as `icon.tsx`, at a size where the wireframe detail —
 * `LatticeMark`'s ring, meridian ellipse and equator line per outer sphere — actually
 * reads, rather than the solid-fill simplification the 32px favicon needs.
 *
 * 180×180 is the size Apple asks for. No rounded corners and no transparency: iOS
 * masks and shadows the icon itself, and supplying either produces a double-rounded
 * tile with a grey fringe. White fill for the same reason as the favicon: the mark's
 * blue elements are designed to sit on a light surface, not the brand-blue tile this
 * route used before.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const MARK_COLOR = "#033291";

export default async function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
      }}
    >
      <svg width={132} height={132} viewBox="0 0 64 64" fill="none">
        {LATTICE_BONDS.map(([from, to], index) => (
          <line
            key={`bond-${from}-${to}`}
            x1={LATTICE_NODES[from]!.x}
            y1={LATTICE_NODES[from]!.y}
            x2={LATTICE_NODES[to]!.x}
            y2={LATTICE_NODES[to]!.y}
            stroke={MARK_COLOR}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={LATTICE_CHARCOAL_BONDS.has(index) ? LATTICE_RECEDED_OPACITY : 1}
          />
        ))}

        {LATTICE_OUTER.map((node, index) => (
          <g
            key={`outer-${index}`}
            opacity={LATTICE_CHARCOAL_OUTER.has(index) ? LATTICE_RECEDED_OPACITY : 1}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={8}
              fill={MARK_COLOR}
              stroke={MARK_COLOR}
              strokeWidth={2.5}
            />
            <ellipse cx={node.x} cy={node.y} rx={3.4} ry={8} stroke="#ffffff" strokeWidth={1.1} />
            <line
              x1={node.x - 8}
              y1={node.y}
              x2={node.x + 8}
              y2={node.y}
              stroke="#ffffff"
              strokeWidth={1.1}
            />
          </g>
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

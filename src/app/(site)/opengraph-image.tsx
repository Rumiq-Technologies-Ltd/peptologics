import { ImageResponse } from "next/og";

import { COMPLIANCE_NOTICE, SITE_NAME, SITE_TAGLINE } from "@/constants/site";

/**
 * The default social preview for every page that does not define its own.
 *
 * Generated rather than a static PNG so the wordmark, tagline and compliance line come
 * from the same constants as the site — a designed image would drift the moment any of
 * them changed.
 *
 * Type-only, no photography. Stock vial imagery on a research-peptide share card
 * implies human use, which is exactly the impression this site must not give.
 */

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#222223",
        padding: 72,
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* The gradient rule echoing the logo's blue-to-charcoal ring. */}
        <div
          style={{
            display: "flex",
            width: 180,
            height: 6,
            backgroundImage: "linear-gradient(90deg, #033291 0%, #1d4ed8 60%, #92aef4 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 88,
            fontWeight: 700,
            letterSpacing: -2,
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 34, color: "#92aef4" }}>
          {SITE_TAGLINE}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 30,
            color: "#c8c8cb",
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          Lyophilized research peptides with lot documentation. Compare list pricing and cost per
          milligram, then request a quotation.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 22,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "#9a9a9e",
        }}
      >
        {COMPLIANCE_NOTICE}
      </div>
    </div>,
    size,
  );
}

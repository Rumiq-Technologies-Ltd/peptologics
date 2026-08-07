import { ImageResponse } from "next/og";

/**
 * Favicon.
 *
 * Generated from the brand colours rather than shipped as an .ico: a 32px monogram on
 * the logo's cobalt reads far better in a tab strip than the badge lockup scaled down,
 * where the lattice glyph turns to mush.
 *
 * Note `src/app/favicon.ico` still exists and Next serves it to clients that ask for
 * `/favicon.ico` directly. This route covers the `<link rel="icon">` modern browsers
 * prefer.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#033291",
        color: "#ffffff",
        fontSize: 20,
        fontWeight: 700,
        borderRadius: 6,
      }}
    >
      P
    </div>,
    size,
  );
}

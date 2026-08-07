import { ImageResponse } from "next/og";

/**
 * Home-screen icon for iOS.
 *
 * 180×180 is the size Apple asks for. No rounded corners and no transparency: iOS
 * masks and shadows the icon itself, and supplying either produces a double-rounded
 * tile with a grey fringe.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#033291",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>P</div>
      <div style={{ display: "flex", width: 72, height: 4, backgroundColor: "#92aef4" }} />
    </div>,
    size,
  );
}

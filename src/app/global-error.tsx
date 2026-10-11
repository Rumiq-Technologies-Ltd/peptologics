"use client";

import type { CSSProperties } from "react";

/**
 * Last-resort error boundary, for a failure in the root layout itself.
 *
 * It replaces the root layout, so the site's stylesheet, fonts and providers are not present.
 * It therefore carries its own document and inline styles, using the brand and ink values from
 * `globals.css`. A plain anchor is used for "back to the start" on purpose: the app shell may be
 * what failed, so a client-side link cannot be relied on here.
 */

const BUTTON: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "2.75rem",
  padding: "0 1.25rem",
  borderRadius: "0.375rem",
  fontSize: "0.95rem",
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
};

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem 1rem",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          color: "#222223",
          background: "#ffffff",
        }}
      >
        <title>Something went wrong | PeptoLogics</title>
        <main style={{ maxWidth: "36rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#0031bc",
            }}
          >
            PeptoLogics
          </p>
          <h1 style={{ margin: "1rem 0 0", fontSize: "2rem", fontWeight: 800, lineHeight: 1.15 }}>
            Something went wrong.
          </h1>
          <p style={{ margin: "1rem 0 0", lineHeight: 1.6, color: "#444343" }}>
            The page could not be loaded. Please try again. If it keeps happening, contact us and
            quote the reference below.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{ ...BUTTON, border: "none", background: "#0031bc", color: "#ffffff" }}
            >
              Try again
            </button>
            {/*
              A full document load on purpose. This boundary replaces the root layout, so the
              client router may be the very thing that failed.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see the comment above */}
            <a href="/" style={{ ...BUTTON, border: "1px solid #75757a", color: "#222223" }}>
              Back to the start
            </a>
          </div>
          {error.digest ? (
            <p
              style={{
                marginTop: "2rem",
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: "0.75rem",
                color: "#444343",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}

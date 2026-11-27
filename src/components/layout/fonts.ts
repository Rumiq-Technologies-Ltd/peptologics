import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";

/**
 * EXPERIMENT — the display face, in place of Inter.
 *
 * The brief asked for General Sans or Aileron. Neither is on Google Fonts, and the CSP
 * pins `font-src` to `'self'`, so a Fontshare or CDN link would be blocked at runtime:
 * using either for real means committing the licensed files to `public/` and wiring
 * `next/font/local`. Plus Jakarta Sans is the closest thing available through
 * `next/font/google` — the same geometric-humanist grotesk with a wide weight range —
 * and it self-hosts at build time, so nothing about the policy has to move to judge the
 * direction. Swap in the real face if the direction is approved.
 *
 * Note this overrides CLAUDE.md, which mandates Inter. Deliberate, and scoped to this
 * branch.
 *
 * IBM Plex Mono is untouched: numeric data only — product codes, vial sizes, prices —
 * where a monospace face keeps table columns optically aligned.
 *
 * Both are preloaded: mono appears inside fixed-width catalog columns, so a late
 * swap would shift row heights and cost CLS.
 */
export const displaySans = Plus_Jakarta_Sans({
  variable: "--font-display-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  preload: true,
});

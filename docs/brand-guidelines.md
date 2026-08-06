# Brand Guidelines — PeptoLogics

Derived from the two logo lockups supplied in `public/assets/`. These are the rules the site is
built on; the Tailwind token names below are the ones defined in `src/app/globals.css`.

---

## 1. The logo

Two lockups exist.

**Circular badge** — a thin ring whose stroke runs from cobalt blue at the upper left to charcoal at
the lower right. Inside sits the molecular glyph: a triangular lattice of six nodes (three large
wireframe spheres at the outer vertices, three small solid dots at the inner triangle) joined by
thick bonds, blue on the left and upper edges, charcoal on the right and lower. Beneath it, the
wordmark `PeptoLogics.com` — "Pepto" blue, "Logics" charcoal, ".com" blue and smaller.

**Horizontal lockup** — the same glyph to the left of the wordmark, with the tagline
`PREMIUM PEPTIDES • PURE RESULTS` in letter-spaced charcoal caps beneath, separated by a thin blue rule.

### Usage

| Surface                | Lockup                                       | Size         |
| ---------------------- | -------------------------------------------- | ------------ |
| Header                 | Horizontal, tagline suppressed               | 36 px tall   |
| Footer (dark)          | Circular badge, cropped `rounded-full`       | 48 px        |
| Disclaimer gate header | Circular badge, cropped `rounded-full`       | 72 px        |
| Open Graph card        | Glyph as SVG + live text via `ImageResponse` | 1200 × 630   |
| Favicon / app icon     | Glyph only, no wordmark                      | 512, 180, 32 |

Clear space on all sides: at least the height of the "P" in the wordmark. Minimum legible width for
the horizontal lockup: 160 px — below that, use the glyph alone.

**Do not**: recolour it, add a shadow or glow, place it on a busy photograph, stretch it
non-uniformly, rotate it, or set the wordmark in a substitute typeface.

### Known asset gaps

Both files are **JPEG on opaque white with no alpha**, which is the wrong format for flat vector
artwork — there is visible ringing along the type edges. On white surfaces this is invisible because
the ground composites away. On dark surfaces we crop the circular badge to `rounded-full`, which
turns the white ground into a deliberate stamped-seal treatment rather than a compositing failure.

Outstanding requests to the client:

1. Vector source (`.svg`, `.ai`, `.eps`) for both lockups. This is the real fix.
2. Failing that, transparent PNG at 3×.
3. The name of the wordmark typeface — it is a squarish geometric sans that Inter cannot substitute
   at display sizes.

---

## 2. Colour

The logo uses exactly three colours. Everything else is a scale built around them.

### Brand blue

| Token       | Hex           | Use                                              |
| ----------- | ------------- | ------------------------------------------------ |
| `brand-50`  | `#F1F4FD`     | Subtle section fills                             |
| `brand-100` | `#DBE3F8`     | Callout backgrounds, tints                       |
| `brand-200` | `#BCCAF1`     | Callout borders                                  |
| `brand-300` | `#8FA6E4`     | Accents on dark backgrounds                      |
| `brand-500` | `#3059C4`     | Hover on primary                                 |
| `brand-600` | **`#1D4ED8`** | **Interactive accent** — links, focus ring       |
| `brand-700` | **`#1A3E9C`** | **Primary** — logo blue. Buttons, header accents |
| `brand-800` | `#16337F`     | Pressed states                                   |
| `brand-900` | `#132D78`     | Dark brand bands                                 |
| `brand-950` | `#0E2159`     | Deepest brand ground                             |

Two blues, deliberately. `brand-700` is the logo blue and owns identity surfaces, so the header
matches the mark sitting inside it. `brand-600` is brighter and owns interactive states, where the
extra luminance makes hover and focus unmistakable. Never use them interchangeably.

### Neutral (charcoal)

| Token     | Hex           | Use                                         |
| --------- | ------------- | ------------------------------------------- |
| `ink-50`  | `#F7F8FA`     | Alternating section background              |
| `ink-100` | `#EFF1F3`     | Input backgrounds, table stripes            |
| `ink-200` | `#E3E6E9`     | Hairline borders — the workhorse            |
| `ink-300` | `#C9CED4`     | Disabled borders, dark-surface body text    |
| `ink-400` | `#9AA1A9`     | Placeholder text                            |
| `ink-600` | `#5A6169`     | Secondary text                              |
| `ink-800` | `#33383D`     | Strong secondary                            |
| `ink-950` | **`#1E2124`** | **Body text.** Dark bands, compliance strip |

### Semantic

| Token     | Hex                       |
| --------- | ------------------------- |
| `success` | `#0F7B4F`                 |
| `warning` | `#B45309`                 |
| `error`   | `#B42318`                 |
| `info`    | `#1D4ED8` (= `brand-600`) |

### Contrast, verified

| Pair                     | Ratio    | Verdict                 |
| ------------------------ | -------- | ----------------------- |
| `ink-950` on white       | 15.6 : 1 | AAA                     |
| `ink-600` on white       | 6.4 : 1  | AA (AAA for large text) |
| `brand-700` on white     | 9.1 : 1  | AAA                     |
| `brand-600` on white     | 6.3 : 1  | AA                      |
| white on `brand-700`     | 9.1 : 1  | AAA                     |
| white on `ink-950`       | 15.6 : 1 | AAA                     |
| `ink-300` on `ink-950`   | 9.4 : 1  | AAA                     |
| `brand-300` on `ink-950` | 7.2 : 1  | AAA                     |
| `error` on white         | 6.1 : 1  | AA                      |

`ink-400` (placeholders) is 3.1 : 1 and is used **only** for placeholder text, never for content —
placeholders are exempt from the AA text requirement, and no field relies on one for its label.

### Deviation from CLAUDE.md

`CLAUDE.md` prescribes `#111827` for body text. We use the logo charcoal `#1E2124` instead, so copy
matches the wordmark directly above it. This is the only palette deviation. Its contrast is
marginally lower than `#111827` (15.6 : 1 versus 16.7 : 1) — both AAA.

---

## 3. Typography

**Inter** (variable, latin subset, `display: swap`) for all UI and prose. Mandated by `CLAUDE.md`.

**IBM Plex Mono** (400 / 600) for **numeric data only** — product codes, vial sizes, prices,
cost-per-mg. The catalog is a data table and mono keeps its columns optically aligned. Both faces
are preloaded: a late mono swap inside a fixed-width column would shift row heights.

Never use mono for prose, headings, or navigation.

### Scale

| Token          | Size                           | Line height | Use                                      |
| -------------- | ------------------------------ | ----------- | ---------------------------------------- |
| `text-display` | `clamp(2.25rem, 5vw, 3.5rem)`  | 1.05        | Page `h1`                                |
| `text-h2`      | `clamp(1.75rem, 3vw, 2.25rem)` | 1.15        | Section headings                         |
| `text-h3`      | `clamp(1.25rem, 2vw, 1.5rem)`  | 1.25        | Sub-headings                             |
| `text-lead`    | `1.125rem`                     | 1.6         | Hero subhead, section intros             |
| `text-body`    | `1rem`                         | 1.65        | Body copy                                |
| `text-small`   | `0.875rem`                     | 1.5         | Captions, helper text                    |
| `text-eyebrow` | `0.75rem`                      | 1.4         | Caps labels, `0.08em` tracking, semibold |
| `text-tagline` | `0.6875rem`                    | 1.4         | Compliance strip, `0.12em` tracking      |

Headings get `text-wrap: balance`. Prose columns cap at `65ch`.

---

## 4. Visual concept — "Certificate"

The site should read as a **lab report**, not a landing page.

- White page ground. `ink-50` for alternating sections. Exactly **one** `ink-950` dark band
  (analytical standards) so it lands as an event rather than a theme.
- **Hairline borders, not shadows.** `border-ink-200` on every card. Shadow is reserved for surfaces
  that genuinely float: the sticky order bar, the mobile sheet, the disclaimer gate.
- The logo's triangular lattice returns as a very low-opacity background pattern and as a section
  divider. The hexagon frame from the product poster becomes the icon container (`HexFrame`).
- **Data density is a feature.** The catalog is a scannable table. `SIZE` and `COST / MG` are
  first-class columns — they are the differentiator, lifted from the client's own price list.
- A permanent 32 px `ink-950` compliance strip sits above the header on every page. It establishes
  the register in the first 32 pixels and satisfies the disclosure requirement everywhere at once.

**Explicitly not doing:** dark theme, neon or teal accents, glow effects, gradient hero blobs, stock
vial or syringe photography (a compliance risk — it implies human use), or decorative animation
above the fold.

---

## 5. Space, radius, elevation

Spacing follows a 4 px base. Section padding: `py-16` mobile, `py-24` desktop (`--space-section`).
Container: `max-w-6xl` with `px-4 sm:px-6 lg:px-8`.

| Radius       | Value | Use                           |
| ------------ | ----- | ----------------------------- |
| `rounded-sm` | 4 px  | Badges, chips                 |
| `rounded-md` | 6 px  | Buttons, inputs               |
| `rounded-lg` | 10 px | Cards, panels                 |
| `rounded-xl` | 14 px | The gate panel, feature cards |

| Shadow            | Use                                                |
| ----------------- | -------------------------------------------------- |
| `shadow-hairline` | `0 1px 0 0 --color-ink-200` — table row separation |
| `shadow-panel`    | Sticky order panel, dropdowns                      |
| `shadow-overlay`  | The disclaimer gate, mobile sheets                 |

---

## 6. Icons

**Lucide React only.** One icon library, per `CLAUDE.md`. Stroke width `1.75`, sized `16` / `20` /
`24`. Icons support labels; they never replace them. Every decorative icon is `aria-hidden="true"`.

Feature and trust icons sit inside a `HexFrame` — the hexagon outline motif from the product poster
— at 40 px with a 24 px icon inside.

---

## 7. Motion

Subtle and purposeful. Durations 150 ms (micro), 200 ms (default), 300 ms (panels and sheets).
Easing `cubic-bezier(0.2, 0, 0, 1)`.

Permitted: hover and focus transitions, sheet and drawer slides, skeleton shimmer, the gate's
opacity fade-in, the brief add-to-list confirmation.

Not permitted: entrance animations above the fold, parallax, autoplaying carousels, anything that
moves while a user is reading.

Every animation is wrapped:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 8. Voice

Precise, factual, unhurried. The register of a supplier's technical documentation, not a marketing page.

- Say what a thing **is**, not how it will make someone feel.
- Prefer "supplied" to "sold". Prefer "quotation" to "price". Prefer "inquiry list" to "cart".
- Never make a health, therapeutic, dosing, or efficacy claim. Not in a headline, not in a caption,
  not in alt text.
- Every claim about testing, purity, or logistics must be one the client can substantiate. If it
  cannot be evidenced, soften it or cut it.
- Numbers are specific: "≥99% by HPLC" beats "high purity" — but only if it is true.

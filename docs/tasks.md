# Task Checklist — PeptoLogics

> Work top to bottom, one task at a time. Tick a box only when the task is genuinely finished.
> Every phase must end green on `npm run typecheck && npm run lint && npm run build`.
> Brief: [instructions.md](./instructions.md) · Decisions: [decisions.md](./decisions.md)

Legend: `[ ]` pending · `[x]` done · `[!]` blocked on the client

---

## Phase 0 — Foundation

Branch `chore/project-foundation`
Commit `chore: scaffold layered architecture with env validation and structured logging`

- [x] Install runtime deps: `@supabase/supabase-js`, `zod`, `react-hook-form`, `@hookform/resolvers`, `zustand`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `sonner`, `server-only`
- [x] Install dev deps: `prettier`, `prettier-plugin-tailwindcss`, `eslint-config-prettier`, `tw-animate-css`, `supabase`
- [x] `.prettierrc.json` + `.prettierignore`
- [x] ESLint: `no-console`, `no-explicit-any`, consistent type imports, and the presentation-boundary `no-restricted-imports` zones
- [x] `.gitignore`: un-ignore `.env.example`
- [x] `src/lib/env.ts` (Zod-validated, `server-only`) + `src/lib/env.client.ts`
- [x] `src/lib/logger/` — dependency-free structured JSON logger
- [x] `src/types/result.ts` — `ServiceResult` contract
- [x] `src/types/api.ts` — HTTP response envelope
- [x] `src/lib/errors/` — typed hierarchy with `publicMessage` / `retryable`
- [x] `src/lib/http/responses.ts` — envelope helpers + service-failure mapping
- [x] `src/lib/resilience/` — `withTimeout`, `withRetry`
- [x] `src/lib/security/` — `request.ts` (same-origin, IP hashing), `sanitize.ts`
- [x] `src/constants/` — `site.ts`, `routes.ts`, `business.ts`, `messages.ts`
- [x] `src/utils/` — `formatCurrency.ts`, `formatStrength.ts`, `slugify.ts`, `cn.ts`
- [x] `.env.example` documenting every variable
- [x] `docs/instructions.md`, `docs/tasks.md`
- [x] `docs/brand-guidelines.md`
- [x] `docs/architecture.md`, `docs/decisions.md` (ADR-001..013), `docs/database.md`, `docs/api.md`, `docs/deployment.md`
- [x] `package.json` scripts: `typecheck`, `format`, `format:check`, `verify`, `db:*`
- [x] Rewrite `README.md`
- [x] Verify: typecheck + lint + format + build all green

---

## Phase 1 — Database

Branch `feature/database-schema`
Commit `feat: add products, orders and order_items schema with RLS and atomic inquiry RPC`

- [ ] `supabase/config.toml`
- [ ] Migration: extensions (`pgcrypto`) + `set_updated_at()` trigger helper
- [ ] Migration: `products` — generated `cost_per_mg`, status CHECK, indexes, RLS
- [ ] Migration: `orders` — order-number sequence, `idempotency_key UNIQUE`, status CHECK, RLS
- [ ] Migration: `order_items` — FKs, arithmetic CHECK, RLS
- [ ] Migration: `notification_log` — per-order-per-channel delivery record, RLS
- [ ] Migration: `rate_limit_hits` — fixed-window counters on a hashed IP, RLS
- [ ] Migration: `fn_create_inquiry` — the atomic order + items RPC
- [ ] Migration: `fn_check_rate_limit` — atomic increment-and-test RPC
- [ ] `supabase/seed.sql` — the 12 products, idempotent upsert by slug
- [ ] Generate `src/types/database.types.ts`
- [ ] `docs/database.md` — ERD, every column, constraints, indexes, RLS posture
- [ ] Verify: 5 tables present; 12 products; `get_advisors` clean; `create_inquiry` idempotent; rate limit blocks on hit 6
- [!] Client: paste `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` into `.env.local`
- [!] Client: confirm the 12 prices against your own records

---

## Phase 2 — Product catalog data path

Branch `feature/product-catalog`
Commit `feat: add product catalog with repository and service layers`

- [ ] `src/lib/supabase/client.server.ts` — anon (read) and service-role (write) clients, `server-only`
- [ ] `src/features/products/types/product.ts`
- [ ] `src/features/products/mappers/product.mappers.ts` — the single row-to-domain boundary
- [ ] `src/features/products/services/product.repository.ts` — explicit column lists, no `SELECT *`
- [ ] `src/features/products/services/product.service.ts`
- [ ] `src/services/container.ts` — the one composition root
- [ ] `GET /api/products`, `GET /api/health`
- [ ] `/products` — Server Component, `revalidate`, `loading.tsx`, `error.tsx`
- [ ] `/products/[slug]` — `generateStaticParams`, `generateMetadata`, `loading`, `error`, `not-found`
- [ ] Verify: 12 items listed; bad slug 404s; `/api/health` reports the DB reachable

---

## Phase 3 — Design system, shell, disclaimer gate

Branch `feature/design-system-and-disclaimer-gate`
Commit `feat: add design system, site shell and research-use-only gate`

- [ ] `shadcn init` for Tailwind v4 (`components.json` with `"config": ""`, utils alias `@/utils/cn`)
- [ ] Add primitives: button, input, textarea, label, checkbox, badge, card, sheet, dialog, drawer, dropdown-menu, popover, separator, skeleton, sonner
- [ ] `globals.css` — full `@theme` token set from the logo palette; remove the dark-mode block; `scrollbar-gutter: stable`; focus-visible ring
- [ ] `layout.tsx` — Inter + IBM Plex Mono, `metadataBase`, `#site-root`, `data-scroll-behavior="smooth"`
- [ ] `LatticeMark.tsx` — hand-authored SVG glyph (feeds favicon, OG image, patterns)
- [ ] `HexFrame.tsx` — the hexagon icon container motif
- [ ] Layout: `ComplianceStrip`, `SiteHeader`, `HeaderNav`, `MobileNav`, `SiteFooter`, `Container`, `Section`
- [ ] Shared: `SkipLink`, `AnnounceRegion`, `EmptyState`, `ErrorState`, `SectionHeading`, skeletons
- [ ] **Disclaimer gate**: pre-paint script, `role="dialog"` + `aria-modal`, `inert` focus trap, scroll lock, four checkboxes, `aria-disabled` submit, no Escape dismissal, `<noscript>` banner, route exemptions, `/not-eligible`
- [ ] Home page with real copy: hero, trust bar, featured products, how it works, analytical standards, FAQ, final CTA
- [ ] Legal page stubs: terms, privacy, research-use-only, shipping
- [ ] `about`, `contact`, `lab-testing` pages
- [ ] Verify: `curl` shows full content in raw HTML; no gate flash on reload; keyboard cannot escape the dialog; Escape does not dismiss; Lighthouse a11y ≥ 95; check mobile/tablet/desktop in the browser
- [!] Client: transparent SVG or PNG logo; the wordmark typeface name
- [!] Client: counsel-reviewed Research-Use-Only text
- [!] Client: trust-badge captions you can substantiate

---

## Phase 4 — Persisted inquiry list

Branch `feature/cart`
Commit `feat: add persisted inquiry list with server-authoritative pricing groundwork`

- [ ] `src/store/cart.store.ts` — `persist` + `skipHydration` + `partialize` (IDs and quantities only) + `migrate`
- [ ] `CartHydrator` — explicit `rehydrate()`, sets `hasHydrated` even on failure
- [ ] `src/hooks/useCart.ts` — atomic per-row selectors so one click does not re-render 40 rows
- [ ] `src/features/cart/utils/cart.calculations.ts`
- [ ] `ProductRowControls` — quantity stepper + add, with non-intrusive confirm feedback
- [ ] `OrderSummaryPanel` — sticky desktop sidebar
- [ ] `StickyOrderBar` + `MobileOrderDrawer`
- [ ] `CartBadge` in the header (absolutely positioned, so it costs no layout)
- [ ] `/cart` page + `loading.tsx`
- [ ] Verify: persists across reload with no hydration warning; an archived product drops out; quantity clamps

---

## Phase 5 — Inquiry submission and email

Branch `feature/inquiry-submission`
Commit `feat: add inquiry submission with atomic persistence and email notification`

- [ ] `src/lib/validations/inquiry.schema.ts` — shared client/server, **no price field**
- [ ] `src/features/inquiry/services/order.repository.ts`
- [ ] `src/features/inquiry/services/inquiry.service.ts` — spam, rate limit, price authority, atomic persist, isolated notifications
- [ ] `src/features/inquiry/services/rate-limit.service.ts`
- [ ] `src/services/notification.service.ts` — cannot rethrow; writes every outcome to `notification_log`
- [ ] `src/lib/resend/` + `email.service.ts` via raw `fetch`
- [ ] Email templates: internal notification
- [ ] `POST /api/inquiries` — honeypot, dwell time, same-origin, `Idempotency-Key`
- [ ] `InquiryForm` — RHF + zodResolver, error summary with `role="alert"`, per-field messages
- [ ] `/inquiry` + `loading` + `error`; `/inquiry/success` with the `wa.me` CTA
- [ ] `docs/api.md`
- [ ] Verify: 1 order + N items + 2 notification rows; double-submit yields one order; 6th submit 429s with `Retry-After`; honeypot returns 201 persisting nothing; injected price ignored
- [!] Client: `RESEND_API_KEY`, verified sending domain (SPF/DKIM DNS), recipient inbox
- [!] Client: company WhatsApp number

---

## Phase 6 — WhatsApp

Branch `feature/whatsapp-notifications`
Commit `feat: add env-gated WhatsApp Cloud API notifications`

- [ ] `whatsapp.service.ts` — Meta adapter, null adapter, factory
- [ ] Template parameter flattening (Meta forbids newlines and 4+ spaces in variables)
- [ ] WhatsApp runbook in `docs/deployment.md`
- [ ] Verify: disabled records `skipped` and the flow is unaffected; enabled delivers the template
- [!] Client: Meta Business verification, WABA, phone number ID, System User token, **approved template**.
  **Start this during Phase 0 — it is the longest lead time in the project.**

---

## Phase 7 — SEO and performance

Branch `feature/seo-and-metadata`
Commit `feat: add metadata, structured data, sitemap and OG images`

- [ ] `metadataBase` + per-page `generateMetadata` + canonicals
- [ ] JSON-LD: Organization, WebSite, Product (**without `offers`** — see ADR-012), BreadcrumbList, FAQPage
- [ ] `sitemap.ts`, `robots.ts`
- [ ] `opengraph-image.tsx`, `icon.tsx`, `apple-icon.png`
- [ ] `noindex` on cart, inquiry, success, not-eligible
- [ ] `POST /api/revalidate`
- [ ] `next.config.ts`: `images.remotePatterns`
- [ ] Verify: Lighthouse ≥ 95 on all four; Rich Results passes on a product page; sitemap lists 12 slugs

---

## Phase 8 — Tests

Branch `test/critical-paths`
Commit `test: add unit and e2e coverage for the inquiry path`

- [ ] Install `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`
- [ ] Unit: price authority, quantity bounds, unavailable products
- [ ] Unit: honeypot, rate limit, replay, notification isolation
- [ ] Unit: `withRetry` retryable-vs-not classification; Zod schemas
- [ ] E2E: gate → browse → add → submit → success
- [ ] E2E: double-submit; honeypot; keyboard-only gate traversal

---

## Phase 9 — Deployment

Branch `chore/deployment`
Commit `chore: configure vercel deployment and production environment`

- [ ] Link the Vercel project; set the preview/production env matrix
- [ ] Domain + DNS; Resend domain verification
- [ ] Security headers in `next.config.ts`: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`
- [ ] Production Supabase migrations applied
- [ ] `docs/deployment.md` with a rollback procedure
- [!] Client: Vercel account/team access, domain registrar access

---

## Phase 10 — Cache Components (optional, post-launch only)

Branch `perf/enable-cache-components`

- [ ] `cacheComponents: true`; delete every `revalidate` / `dynamic` / `fetchCache` export
- [ ] `'use cache'` + `cacheLife` + `cacheTag` on the product reads
- [ ] `revalidateTag(tag, 'max')` — the profile argument is required in v16
- [ ] Sweep for synchronous IO in prerendered paths (`new Date()` in a footer, etc.)

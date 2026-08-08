# Architecture Decision Record — PeptoLogics

Newest last. Each entry states the decision, why, and what it costs.

---

## ADR-001 — Products live in Supabase, not in a constants file

**Status** Accepted · Phase 1

`CLAUDE.md` requires it, and it is right: prices change, and a code deploy is the wrong mechanism for
a price change. The catalog is read server-side and statically rendered with a one-hour ISR window,
so there is no per-request query cost on the hot path.

**Cost** The build depends on Supabase being reachable, because `generateStaticParams` reads the slug
list at build time. It also means a product added after a deploy is not reachable until the next
build — see ADR-014, which supersedes the original mitigation here.

---

## ADR-002 — Money is stored as integer cents

**Status** Accepted · Phase 1

PostgREST serialises Postgres `numeric` as a **JSON string** to avoid IEEE-754 loss, so
`price numeric(10,2)` arrives in TypeScript as `"60.00"`. The options are then to `parseFloat` it —
reintroducing float error into subtotal arithmetic — or to thread strings through the whole
application. Integer cents arrive as `number` and stay exact through every multiplication and sum, in
both Postgres and JavaScript. It also makes `CHECK (subtotal_cents = unit_price_cents * quantity)` a
meaningful invariant.

Columns are suffixed `_cents` so the unit cannot be misread.

**Cost** Every display path must divide by 100. Contained to `src/utils/formatCurrency.ts`.

---

## ADR-003 — `cost_per_mg` is a stored generated column

**Status** Accepted · Phase 1

Every value on the client's price list is exactly `price / strength_mg`. Three options:

- Compute in the application — rejected. `CLAUDE.md` requires sorting and filtering in SQL, and
  "sort by best value per mg" is an obvious near-term feature. You cannot `ORDER BY` a value that
  only exists in JavaScript.
- A plain stored column — rejected. Two sources of truth; a price edit silently desyncs it.
- `GENERATED ALWAYS AS (...) STORED` — accepted. Postgres recomputes it on every write, it is
  physically stored so it is indexable and sortable, and it cannot be written directly.

Stored as `numeric(10,4)` so K-L-O-W's true 0.9375/mg stays honest; rounded to two places for display.

**Cost** PostgREST returns it as a string, so it is coerced with `Number()` once in
`product.mappers.ts`. Safe because the value is display-only and never enters money arithmetic.

**Open** A "cost per mg" for a multi-peptide blend is not comparable to a single peptide's. An
`is_blend` flag suppresses the figure for K-L-O-W.

---

## ADR-004 — Atomicity via a Postgres function, not application code

**Status** Accepted · Phase 1

The Supabase JS client cannot run multi-statement transactions over the REST API, so inserting one
`orders` row followed by N `order_items` rows is not atomic. A compensating delete on failure was
rejected — it is a distributed-transaction pattern that itself can fail, leaving exactly the orphaned
state it was meant to prevent.

Instead, a single `create_inquiry(payload jsonb)` function does both inserts inside one implicit
transaction, with `ON CONFLICT (idempotency_key) DO NOTHING` and a read-back. Called via `.rpc()`.

**Cost** Business logic in SQL, which `CLAUDE.md` discourages. Accepted narrowly: the function
performs no business decisions, only the atomic write the client library cannot express.

---

## ADR-005 — The server is the sole price authority

**Status** Accepted · Phase 5

The inquiry Zod schema contains **no price field at all**. The wire payload carries only
`{ productId, quantity }`. The service re-reads `price_cents` from `products` and computes every
subtotal itself.

This is structural rather than defensive: a tampered client cannot influence a price because there is
no field in which to send one. Validating a submitted price would be weaker — it would require the
check to be correct, where this requires nothing.

**Cost** One extra query per submission. Irrelevant at this volume.

---

## ADR-006 — Route Handler for inquiry submission, not a Server Action

**Status** Accepted · Phase 5

The endpoint needs a `Retry-After` response header for rate limiting, an `Idempotency-Key` request
header, and a documented public contract in `docs/api.md`. Server Actions give none of those
ergonomically. Client-side validation still shares the same Zod schema, so nothing is duplicated.

---

## ADR-007 — WhatsApp ships as a deep link plus a null adapter

**Status** ~~Accepted~~ **Superseded by ADR-023** · Phase 5. Kept for the reasoning, which is what
made the removal an easy call: the null adapter meant nothing had to be unpicked.

Server-side sending through the Meta Cloud API requires Business Verification, a WhatsApp Business
Account, a registered number, a System User permanent token, **and an approved message template**.
The template is not optional here: free-form text is only permitted within 24 hours of the
_recipient's_ last inbound message, and the recipient is the company's own phone, which will never
message its own WABA number. So we are permanently outside that window.

Layered accordingly:

1. A `wa.me` deep-link CTA on the success page and in the footer. Zero credentials, works today, and
   it opens the 24-hour window as a side effect.
2. A `WhatsAppService` interface whose default is a **null adapter** — returns `{ skipped: true }`,
   logs once, records `status = 'skipped'`. The build, the tests, and the whole inquiry flow work
   with no WhatsApp credentials.
3. The Meta adapter, activated by env only, added later. Nothing else changes.

**Email is the authoritative channel.** No part of the launch waits on Meta.

**Cost** A deep link needs the customer to press send, so it is not a system notification. Acceptable
because it is additive — email already guarantees delivery.

**Noted, not adopted** A Telegram bot posting into a company group is roughly ten minutes of work,
free, with no approval, no templates and no 24-hour window. It is off-spec (`CLAUDE.md` names
WhatsApp) so it has not been adopted unilaterally, but it would remove the entire Phase 6 dependency
chain if the client accepts it.

---

## ADR-008 — `cacheComponents` stays off until after launch

**Status** Accepted · revisit in Phase 10

Enabling Next 16's Cache Components makes synchronous IO a **hard build error** in prerendered paths
— `new Date()`, `Math.random()`, `crypto.randomUUID()` — and requires `generateStaticParams` to
return at least one param, so a Supabase incident turns a routine deploy into a red build.

The payoff is streaming per-request personalisation into a static shell. This site has no auth, no
personalisation, and a client-side cart. There is nothing to stream. Plain `revalidate = 3600` plus
`generateStaticParams` already delivers CDN-served HTML, which is the actual requirement.

Adopting it later is mechanical **because** the disclaimer gate (ADR-009) and the cart (ADR-010) were
chosen so that nothing reads cookies or headers in the root layout. That is a deliberate property of
the design, not luck.

---

## ADR-009 — The disclaimer gate is a client overlay, not a cookie or a redirect

**Status** Accepted · Phase 3

The site must stay indexable. That single requirement eliminates the alternatives:

- **httpOnly cookie read in the root layout** — crawlers carry no cookie, so they always get the
  un-accepted branch. If that branch renders the gate instead of content, indexing dies. If it
  renders content anyway, the cookie bought nothing. It also makes every route dynamic, and under
  Cache Components `cookies()` inside a `use cache` scope throws outright.
- **`proxy.ts` redirect to `/disclaimer`** — every content URL 307s away. Nothing gets indexed.

So: `localStorage`, a client component, and a pre-paint inline script (the pattern Next.js documents
for preventing flash before hydration) that removes the gate for returning visitors before paint.

**How crawlability is preserved.** The server renders the complete page on every request. The gate is
a _sibling_ element covering it with a fixed scrim. Nothing is `display: none` or
`visibility: hidden` — the tempting pre-paint optimisation of hiding the page until acceptance is a
trap, because Googlebot renders with an empty `localStorage` and would therefore see every page
hidden. We accept a brief flash and keep the content honestly visible.

**No user-agent sniffing.** Serving different HTML to Googlebot is cloaking, which is a far larger
risk than the interstitial. Age and legal gates are a stated exception to Google's intrusive-
interstitial guidance.

**Residual risk** Visitors with JavaScript disabled see ungated content. Mitigated with a
`<noscript>` banner carrying the compliance statement. The client must accept this.

---

## ADR-010 — Cart is Zustand with `skipHydration`, persisting IDs only

**Status** Accepted · Phase 4

Zustand over Context + `useReducer` for the `persist` middleware alone — correct SSR rehydration is
subtle and worth not hand-rolling. `skipHydration: true` plus an explicit `rehydrate()` in an effect
is what prevents the hydration mismatch a naive `persist` setup produces.

`partialize` stores **only** `{ productId, quantity }`. No names, no prices. A price change in
Supabase therefore can never be shadowed by stale `localStorage`, and a product that is archived
simply fails to re-join and drops out of the list on next load.

Displayed subtotals are labelled estimates. The server recomputes authoritatively at submit (ADR-005).

---

## ADR-011 — Rate limiting in Postgres, not Redis

**Status** Accepted · Phase 5

A fixed-window counter table plus one atomic increment-and-test function. At this traffic it is
indistinguishable from Redis, and it adds no infrastructure, no vendor, and no secret.

IPs are hashed with a server-side salt before they touch the table. The counter needs a stable key,
not an identity, and a raw address is PII we have no reason to hold.

**Upgrade path** `@upstash/ratelimit` if traffic ever justifies it.

---

## ADR-012 — Product JSON-LD without `offers`

**Status** Accepted · Phase 7

`Product` structured data is emitted with `name`, `sku`, `description`, `brand`, and
`additionalProperty` for size and purity — but **no `offers` / `price`**. Attaching a priced `Offer`
asserts a purchasable offer, which is false: there is no checkout, and pricing is indicative until a
representative confirms it. It would also risk surfacing a research compound in shopping surfaces.

**Cost** No price-rich results in search. Correct trade for an inquiry-only site.

**Needs sign-off** Client and, ideally, counsel.

---

## ADR-013 — Body text uses the logo charcoal, not the prescribed `#111827`

**Status** Accepted · Phase 3

`CLAUDE.md` prescribes `#111827`. We use `#1E2124`, taken from the logo wordmark, so body copy
matches the mark directly above it. Contrast is 15.6 : 1 versus 16.7 : 1 — both AAA. This is the
only palette deviation and it is recorded here rather than applied silently.

---

## ADR-014 — `dynamicParams = false` on the product route, to get a real 404

**Status** Accepted · Phase 2

With `dynamicParams = true`, an unknown product slug is rendered on demand. Because that segment also
sets `revalidate`, Next treats the render as prerenderable and caches it — so `notFound()` renders
`not-found.tsx` but the response carries **HTTP 200**.

Measured, not assumed: against a production build, a never-before-requested slug returned
`200 OK` with `x-nextjs-cache: MISS`. Removing `loading.tsx` from the segment made no difference. A
nonexistent _route_ correctly returned 404, which isolated the cause to the dynamic segment.

That is a soft 404. `robots: { index: false }` from `generateMetadata` stops it being indexed, but the
status is still wrong, and Google reports soft 404s as errors.

Setting `dynamicParams = false` yields a real 404 for any slug outside `generateStaticParams`, while
the twelve known slugs still serve 200.

**Cost** `generateStaticParams` runs at build time only — ISR revalidates existing paths, it does not
discover new ones. So a product added to the database after a deploy 404s until the next build.
Acceptable for a curated twelve-product catalog, and noted in `deployment.md`.

**Not affected** Price changes. `revalidate = 3600` still refreshes data on existing pages, and
`POST /api/revalidate` forces it immediately.

---

## ADR-015 — Segment config values are inlined literals, not shared constants

**Status** Accepted · Phase 2

`export const revalidate` must be **statically analyzable**. Next cannot read an imported constant or
an expression — `revalidate = 60 * 10` is invalid, and importing `CATALOG_REVALIDATE_SECONDS` failed
the build with _"Invalid segment configuration export detected"_, with no indication of which export
was at fault.

So `revalidate = 3600` is written literally in each catalog route, with a comment, and
`constants/business.ts` carries a note explaining why the value is duplicated rather than shared. The
alternative — a constant that silently cannot be used where it is most needed — is worse.

---

## ADR-016 — The service-role key is optional in development, mandatory in production

**Status** Accepted · Phase 2

Requiring `SUPABASE_SERVICE_ROLE_KEY` unconditionally meant nobody could run the read-only catalog
without holding the most dangerous secret in the project. Making it optional unconditionally meant a
production deploy could silently ship with no write path.

So it is `.optional()` at field level, with a cross-field check that requires it when
`NODE_ENV === "production"`. `RATE_LIMIT_SALT` gets the same treatment against its development
default, since a public salt in production defeats the point of hashing.

`next build` sets `NODE_ENV=production`, so these checks fire at build time. That is intended: a
deploy missing either value should fail loudly rather than run degraded. The consequence is that a
local production build needs both set in `.env.local`.

Related: empty values are normalised to `undefined` before parsing. A variable declared but left
blank — `RESEND_API_KEY=` — is read as `""`, which Zod treats as present and failing `.min(1)`. Without
that step an ordinary "not configured yet" env file refuses to boot.

---

## ADR-017 — No route-level `loading.tsx` on statically prerendered routes

**Status** Accepted · Phase 3

`src/app/products/loading.tsx` and `src/app/products/[slug]/loading.tsx` were written, then **removed
after they were found to break their routes**.

**The symptom.** Both pages showed their loading skeleton permanently. Not a flash — the skeleton was
the final rendered state, in dev and in a production build, on a clean browser profile.

**What was measured.** For a route with a `loading.tsx`, the prerendered HTML contains three things:
the skeleton inside `<main>`, the real content parked in `<div hidden id="S:0">` at the end of
`<body>`, and a `$RC("B:0","S:0")` call that is supposed to swap the second into the first. In the
browser the swap never completed: `div[hidden][id^="S:"]` remained in the DOM, `<main>` still held the
skeleton, and `#site-root a[href^="/products/"]` counted **0**.

Isolated by elimination. The home page, which reads the same data through the same service but has no
`loading.tsx`, rendered perfectly — 12 products in place, zero hidden containers. Removing
`products/loading.tsx` and rebuilding made the catalog render correctly and immediately. Neither the
pre-paint script nor the hand-written `<head>` was responsible: disabling each in turn changed nothing.

**Why removing it is right rather than a workaround.** A route-level loading state is meaningless on a
statically prerendered route. `/products` and `/products/[slug]` are built at build time and served
from cache, so a visitor never waits on data — the HTML is already complete when it arrives. The
skeleton could only ever have been decoration, and here it was actively destructive.

**Phase 4 implication.** Adding search and filtering will read `searchParams` and make the catalog
dynamic, at which point a loading state becomes genuinely useful. Reintroduce it as a **scoped
`<Suspense>` boundary around the product list only**, not as a route-level `loading.tsx` — and verify
in a production build that content actually replaces the fallback before considering it done.

**Applied in Phase 4.** `/cart` was checklisted with a `loading.tsx` and shipped without one. It is the
same route class: a server read of the prerendered catalog, with nothing for the visitor to wait on.
Its one genuine wait is client-side — `localStorage` cannot be read until after hydration — so the
skeleton lives inside `CartView` and `OrderSummaryPanel`, gated on `hasHydrated`, where it is replaced
by definition.

**Also note:** an SEO consequence that pointed the same way. With the skeleton as the rendered state,
a JavaScript-rendering crawler would have seen "Loading the product catalog." instead of the products.
The content was in the HTML source, so an HTML-only crawler was fine, but the rendered view was empty.

---

## ADR-018 — `suppressHydrationWarning` on `<html>` is load-bearing

**Status** Accepted · Phase 3

The pre-paint script sets `data-ruo="ok"` on `<html>` before React hydrates. Without
`suppressHydrationWarning` on that element, React reports a hydration mismatch and — in Next's own
words — "recovers by client-rendering from the nearest error or Suspense boundary."

That recovery path is not benign. It discards inline-script corrections within the boundary, and it was
producing a visible console error on every page load. The attribute tells React to keep what the DOM
already contains and discard its own output for that one element, which is exactly the intent.

Diagnosed from the real console error rather than added prophylactically. Documented in
`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`.

**Related, and left as-is:** React also warns that a `<script>` rendered inside a component tree will
not execute on client-side navigation. That is accepted — the script only needs to run on an initial
document load, because after hydration the gate's state comes from the store rather than the DOM
attribute. The inline `<script dangerouslySetInnerHTML>` is the pattern Next documents for this.

---

## ADR-019 — Brand colours are taken from the vector logo, not estimated

**Status** Accepted · Phase 3, supersedes the estimates in ADR-013

The client supplied `peptologics logo.svg`, a true vector with four paths. Its three artwork fills are
exactly `#033291` (cobalt), `#222223` (charcoal) and `#1C2A4A` (deep navy).

The palette had previously been estimated from a compressed JPEG as `#1A3E9C`. The measured value is
noticeably deeper and more saturated, and it is the one now anchoring `brand-800`. Contrast on white
is **11.3 : 1**, better than the estimate.

`#1D4ED8` from `CLAUDE.md` is retained at `brand-600` as the interactive accent, which the client
approved. It sits above `brand-800` in luminance, so the scale stays monotonic.

**Asset handling.** The SVG's first path is an opaque white rectangle covering the whole canvas, which
would render as a white box on the dark footer. `public/brand/peptologics-badge.svg` is the same file
with that one path removed, giving genuine transparency; the original in `public/assets` is untouched.
The supplied PNG is `colorType 2` (RGB, no alpha) so it cannot serve that purpose.

---

## ADR-020 — The inquiry list joins against a server-passed catalog, never a client fetch

**Status** Accepted · Phase 4

The store persists product IDs and quantities only (ADR-010), so something has to supply the names and
prices the list displays. Three options were available: fetch `/api/products` from the browser, keep a
denormalised copy in `localStorage`, or pass the catalog the page already read down as props.

Props win on every axis that matters here. The catalog is twelve rows fetched once per prerender, so a
client fetch would add a round trip and a loading state to data the page is already holding. A
denormalised copy would reintroduce exactly the stale-price problem ADR-010 exists to prevent. And the
join is a pure function over data both surfaces already have, so `/products`, `/products/[slug]` and
`/cart` all stay statically prerenderable with no client-side database access — which the presentation
boundary in `eslint.config.mjs` forbids anyway.

**Consequences.**

- Any page that shows money must pass its catalog to the cart components. That is a real constraint,
  and it is why the mobile bar renders on `/products` (full catalog available) and not on the product
  detail page (one product).
- `reconcile`, which deletes lines whose product is missing, is only safe against a **complete** active
  catalog. It runs on `/cart` and nowhere else; a filtered or searched catalog would make it destroy
  lines the visitor still wants. The store method documents this.
- A withdrawn product needs no special handling: it produces no line, because there is nothing to
  render it from.

**Also decided here: `ProductRow` no longer wraps the whole row in a link.** Adding the quantity
stepper to a row-wide anchor would nest a `<button>` inside an `<a>` — invalid HTML, ambiguous to
assistive technology, and wrong in the keyboard order. The link now wraps the product name, with the
chevron as a second link on surfaces that have no controls. The featured strip loses edge-to-edge
clickability; that is the smaller loss.

---

## ADR-021 — A suppressed submission gets an ordinary success

**Status** Accepted · Phase 5

Two signals mark a submission as automated: a filled honeypot field, and a dwell time under
`MIN_FORM_DWELL_SECONDS` (3s) between form mount and post. Either one means nothing is persisted and
nothing is sent.

**The response is still `201` with the same body a real submission gets**, differing only in
`data.orderNumber` being `null` — which the client uses to skip the reference block on the success page
and nothing else. A rejection would tell the author of the script exactly which check caught them, and
the next version would pass it. Silence costs an author of _legitimate_ automation nothing either,
because there is no legitimate automation posting this form.

Consequences accepted deliberately:

- **A false positive is invisible to the visitor.** Someone whose clock is badly skewed, or who somehow
  fills nine fields in under three seconds, is told "received" and is not. Mitigated by logging every
  suppression with its reason (`honeypot` / `dwell_missing` / `dwell_too_short`) and no customer data,
  so a pattern is diagnosable without retaining junk.
- **A missing `formStartedAt` is treated as a failed dwell check, not a pass.** Our own form always
  sends it, so omitting the field must not be an easier bypass than forging it.
- **`formStartedAt` is client-supplied and therefore forgeable.** A bot that backdates it by a minute
  gets through. This filter is aimed at the common case — a script that posts the instant it parses the
  page — and it is one of four layers, alongside the honeypot, same-origin, and the rate limiter.

The filters live in `InquiryService`, not the Route Handler, because "what do we do about a bot" is a
business rule and the route is meant to stay four checks long.

---

## ADR-022 — Rate limiting fails open

**Status** Accepted · Phase 5

If `check_rate_limit` throws — the database is unreachable, the function is missing — the service logs
`rate_limit_check_failed_open` and allows the submission.

The reasoning is that the counter lives in the _same database_ as the order it is protecting. If the
counter is unreachable, the insert that follows cannot succeed either, so failing closed would convert
one broken dependency into a second and less honest failure: a `429` telling the visitor they have sent
too many inquiries, when in fact we are down. Failing open lets the request proceed and fail, if it
fails, on its own terms — with the message that matches reality.

This is safe only because of that shared fate. If the limiter ever moves to separate infrastructure
(Redis, an edge KV), the trade reverses: an independent limiter being down would no longer imply the
write path is down, and fail-closed — or a local fallback — becomes the correct choice. Revisit this ADR
at that point, not before.

---

## ADR-023 — WhatsApp is removed; email is the only notification channel

**Status** Accepted · supersedes ADR-007 · requested by the client, 7 August 2026

The client's original brief asked for inquiries to reach the company by WhatsApp **and** email. Email
was built first and works: a real submission during Phase 5 verification delivered through Resend on
the first attempt. WhatsApp then required Meta Business Verification, a WhatsApp Business Account, a
registered number, a System User token and an approved message template — days of account work for a
second copy of a notification that already arrives.

The client's decision: drop it. This ADR records that, and what was removed.

**Removed**

- The `WhatsAppService` interface and the null-adapter branch in `NotificationService`.
- Six `WHATSAPP_*` server env vars, `isWhatsAppConfigured`, `WHATSAPP_TIMEOUT_MS`, and
  `NEXT_PUBLIC_WHATSAPP_NUMBER` with its `whatsAppDeepLinkNumber` accessor.
- The `wa.me` deep-link buttons on the success page, the footer and the contact page, and every copy
  line promising WhatsApp contact.
- The second `notification_log` intent row: `create_inquiry` now writes one, for email
  (migration `20260807120000_create_inquiry_email_only`).
- The WhatsApp runbook in `docs/deployment.md`, and Phase 6 in `docs/tasks.md`.

**Deliberately kept**

- `notification_log.channel` still accepts `'whatsapp'`. A CHECK constraint permitting an unused value
  costs nothing, and re-adding a channel should not need a schema migration.
- `NotificationChannel` remains a union of one, and the dispatcher still loops over an array of
  channel results. Restoring a second channel is an adapter plus one array entry.

**Cost accepted** One contact path. If Resend fails for a lead, there is no second channel that might
still deliver — the mitigation is the `notification_log` dead-letter list, which records every failure
for manual follow-up. That was already the design; it now carries more weight.

---

## ADR-024 — The E2E suite intercepts the inquiry endpoint

**Status** Accepted · Phase 8

`e2e/inquiry-journey.spec.ts` drives the real browser through the real form and then
intercepts `POST /api/inquiries`, answering `201` itself.

The alternative — letting the request through — was rejected. Every run would write an
order to the client's production Supabase and send a real email to their inbox, on a
suite that is meant to be run freely and often. Seeding a separate test project would
mean maintaining a second database and a second set of credentials for one spec file.

What is lost is small and already covered elsewhere: the endpoint's own behaviour is
tested at the service level against fakes (`inquiry.service.test.ts`) and was verified
against the live database during Phase 5 — one order, two items, the notification row,
a real email delivered, replay returning the same order, the 6th submission rate-limited.

What is kept is the part only a browser can prove, and it is the part most likely to
break silently:

- the form assembles the correct items and quantities from the persisted list;
- an `Idempotency-Key` header is present and is a UUID;
- **no price field appears anywhere in the request body** — asserted by matching the
  serialised payload against `/price/i` and `/subtotal/i` (ADR-005);
- a double click produces one request, not two;
- the list is cleared and the reference is shown on the success page.

**Cost accepted** A change to the Route Handler's own contract — a renamed field, a
different status code — would not fail this suite. The service tests and the documented
contract in `docs/api.md` are what guard that, and a contract test against a seeded
staging database is the natural thing to add if the endpoint ever grows consumers
beyond our own form.

---

## Open questions — awaiting the client

Nothing here is invented in code without being listed as `PLACEHOLDER`.

### Blocks product content

| #   | Question                                                                                                                                             | Current default                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Product descriptions for all 12 compounds.** Regulated-adjacent copy; will not be AI-generated.                                                    | `NULL` in the seed. Catalog ships with specs only.                                                                                                               |
| 2   | Trust-badge captions. The client's poster renders them as garbled text (`PREGISION YOU CAN FAUST`, `CINOE CADE STRANGES`), so the intent is unknown. | Clean process-only copy written: third-party tested, COA on request, cold-chain handling, sealed and tracked, research use only. **Each must be substantiable.** |
| 3   | Are the 12 prices correct? BPC-157's cost-per-mg is missing its `$` on the poster, which suggests it is not authoritative.                           | Seeded as read.                                                                                                                                                  |
| 4   | Product categories.                                                                                                                                  | `('peptide','blend','cosmetic','supply')` — invented. GHK-Cu is arguably cosmetic.                                                                               |
| 5   | K-L-O-W composition — which peptides at what ratios in the 80 mg blend?                                                                              | `is_blend = true`, cost-per-mg suppressed, no description.                                                                                                       |
| 6   | Which products are featured on the home page, in what order?                                                                                         | `featured = false`, `sort_order = 0` for all.                                                                                                                    |
| 7   | Product photography.                                                                                                                                 | None. Catalog is image-free by design — stock vial photography is a compliance risk.                                                                             |
| 8   | COA availability — per product or per lot? Hosted where?                                                                                             | `coa_url` column exists, unpopulated.                                                                                                                            |

### Blocks the gate

| #   | Question                                                                                                          | Current default                                               |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 9   | **The exact Research-Use-Only legal text.**                                                                       | Professional claim-free draft, marked `TODO: counsel review`. |
| 10  | Re-prompt interval.                                                                                               | 30 days.                                                      |
| 11  | Must acknowledgement be provable per order? If so, the affirmation-text version and IP hash may need storing too. | `orders.ruo_acknowledged_at` only.                            |

### Blocks operations

| #   | Question                                                                                                                        | Current default                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | Which inbox receives inquiries? Which domain sends?                                                                             | Set, but sending from Resend's sandbox `onboarding@resend.dev`, which delivers **only to the Resend account owner**. `peptologics.com` must be verified in Resend before launch.                                        |
| 12b | One Supabase project serves development, preview and production. Create a second for non-production, or use Supabase branching? | Shared. Acceptable while there are no real leads; a preview deploy currently writes orders to the database production reads. Points 1 and 2 in `docs/deployment.md` cover both fixes; neither changes application code. |
| 13  | Does the customer get a confirmation email?                                                                                     | No. Internal notification only.                                                                                                                                                                                         |
| 14  | PII retention period and deletion-request process.                                                                              | No retention job. Rows kept indefinitely.                                                                                                                                                                               |
| 15  | How does the company read inquiries and move `status`?                                                                          | **Supabase Studio. No admin UI is in scope.**                                                                                                                                                                           |
| 16  | Analytics — Vercel, GA4, Plausible, none?                                                                                       | None installed. Affects the CSP header and the privacy policy.                                                                                                                                                          |
| 17  | Shipping geography — US only?                                                                                                   | `country` defaults `'US'`; `state` free text; phone validation permissive so international numbers are not rejected.                                                                                                    |
| 18  | Returns policy and shipping times for the FAQ and Terms.                                                                        | Placeholder text, marked.                                                                                                                                                                                               |
| 19  | Order number format.                                                                                                            | `PL-001000` — invented.                                                                                                                                                                                                 |

### Commercial, not engineering

Retatrutide and Tirzepatide are restricted by most payment processors and by Google and Meta ad
policies. This does not affect the build — there are no payments, which is precisely why the
lead-generation model works — but it will constrain any future payment integration and any paid
acquisition plan.

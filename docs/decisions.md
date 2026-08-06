# Architecture Decision Record — PeptoLogics

Newest last. Each entry states the decision, why, and what it costs.

---

## ADR-001 — Products live in Supabase, not in a constants file

**Status** Accepted · Phase 1

`CLAUDE.md` requires it, and it is right: prices change, and a code deploy is the wrong mechanism for
a price change. The catalog is read server-side and statically rendered with a one-hour ISR window,
so there is no per-request query cost on the hot path.

**Cost** The build depends on Supabase being reachable. Mitigated by `dynamicParams = true`, so an
unknown slug renders on first request rather than failing the build.

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

**Status** Accepted · Phase 5, revisited Phase 6

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

| #   | Question                                                 | Current default                                                                                                      |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 12  | Which inbox receives inquiries? Which domain sends?      | Env vars, unset. Email records `skipped` until set.                                                                  |
| 13  | Does the customer get a confirmation email?              | No. Internal notification only.                                                                                      |
| 14  | PII retention period and deletion-request process.       | No retention job. Rows kept indefinitely.                                                                            |
| 15  | How does the company read inquiries and move `status`?   | **Supabase Studio. No admin UI is in scope.**                                                                        |
| 16  | Analytics — Vercel, GA4, Plausible, none?                | None installed. Affects the CSP header and the privacy policy.                                                       |
| 17  | Shipping geography — US only?                            | `country` defaults `'US'`; `state` free text; phone validation permissive so international numbers are not rejected. |
| 18  | Returns policy and shipping times for the FAQ and Terms. | Placeholder text, marked.                                                                                            |
| 19  | Order number format.                                     | `PL-001000` — invented.                                                                                              |

### Commercial, not engineering

Retatrutide and Tirzepatide are restricted by most payment processors and by Google and Meta ad
policies. This does not affect the build — there are no payments, which is precisely why the
lead-generation model works — but it will constrain any future payment integration and any paid
acquisition plan.

# Architecture — PeptoLogics

Next.js 16.3.0 App Router · React 19.2 · TypeScript strict · Tailwind CSS v4 · Supabase PostgreSQL ·
deployed on Vercel.

---

## 1. Layers

```
┌─────────────────────────────────────────────────────────────┐
│ app/            Routing, metadata, orchestration only       │
├─────────────────────────────────────────────────────────────┤
│ components/     Presentation. No data access, no business   │
│ features/*/     rules. Server Components by default.        │
├─────────────────────────────────────────────────────────────┤
│ hooks/          Client interaction state. No business rules. │
│ store/                                                       │
├─────────────────────────────────────────────────────────────┤
│ services/       Business rules. Decides WHAT happens.       │
│ features/*/services/                                         │
├─────────────────────────────────────────────────────────────┤
│ repositories    Database access only. Fetch, insert, update. │
│ (in features/*/services/*.repository.ts)                     │
├─────────────────────────────────────────────────────────────┤
│ lib/supabase/   Clients. server-only.                        │
├─────────────────────────────────────────────────────────────┤
│ PostgreSQL                                                   │
└─────────────────────────────────────────────────────────────┘
```

Dependency direction is strictly downward. A component never reaches past the service layer.

### How this is enforced

Not by discipline — by tooling, so a violation is a failed build rather than a missed review comment.

1. **`import "server-only"`** at the top of `lib/env.ts`, `lib/security/request.ts`, the Supabase
   clients, every repository, and `services/container.ts`. Importing any of them from a Client
   Component is a build error, not a leaked service-role key.
2. **ESLint `no-restricted-imports`** zones in `eslint.config.mjs`: `components/**` and
   `features/*/components/**` cannot import `lib/supabase/*`, `*.repository`, `lib/env`, or
   `services/container`. `utils/**` and `lib/validations/**` cannot import React or Next at all.
3. **`SUPABASE_ANON_KEY` is deliberately not prefixed `NEXT_PUBLIC_`.** The browser never talks to
   Supabase, so there is no reason for the key to exist in a client bundle.

### Error contract across layers

| Layer         | Behaviour                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Repository    | **Throws** a typed `DatabaseError`. A failed query is exceptional.                                           |
| Service       | **Returns** a `ServiceResult<T>` (`@/types/result`). A rejected inquiry is an expected outcome, not a crash. |
| Route Handler | Maps the result onto the `ApiResponse` envelope via `jsonFromServiceFailure`. Needs no try/catch of its own. |
| UI            | Renders `message` from the envelope. Never sees a stack trace, SQL, or a table name.                         |

Every `AppError` carries a `publicMessage` separately from its technical message. That split is what
stops `relation "orders" does not exist` from ever reaching a browser.

---

## 2. Rendering strategy

`cacheComponents` is **off** (see ADR-008). Standard Next 16 defaults apply: `fetch` is uncached,
Route Handlers are uncached, `revalidate` defaults to `false`.

| Route                                             | Strategy                  | Config                                                                          |
| ------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `/`                                               | Static + ISR              | `revalidate = 3600`                                                             |
| `/products`                                       | Static + ISR              | `revalidate = 3600`                                                             |
| `/products/[slug]`                                | Static + ISR              | `generateStaticParams` (all 12) + `revalidate = 3600` + `dynamicParams = false` |
| `/cart`, `/inquiry`, `/inquiry/success`           | Static shell, client body | `robots: { index: false }`                                                      |
| `/about`, `/contact`, `/lab-testing`, legal pages | Fully static              | —                                                                               |
| `/api/*`                                          | Dynamic                   | Uncached by default in v16                                                      |
| `sitemap.ts`                                      | Static + ISR              | `revalidate = 3600`                                                             |

A price change in Supabase propagates within an hour automatically, or immediately via
`POST /api/revalidate` with the bearer secret. `revalidatePath` is unchanged under Cache Components,
so that endpoint survives a future Phase 10 migration untouched.

Two constraints worth knowing before editing these routes:

- **`revalidate` must be an inlined literal.** Next requires segment config exports to be statically
  analyzable, so it cannot reference a shared constant (ADR-015).
- **`dynamicParams = false` is load-bearing.** With `true`, an unknown slug renders on demand, gets
  cached, and returns HTTP 200 for a page that says "not found" — a soft 404. The trade is that a
  product added after a deploy 404s until the next build (ADR-014).

### Client boundaries

Every page and both layouts are Server Components. `"use client"` appears only at leaf level:

the disclaimer gate, header nav (needs `usePathname`), mobile nav, cart badge, search input, filters,
sort menu, row quantity controls, order summary panel, sticky order bar, mobile drawer, clear-list
dialog, the inquiry and contact forms, and the toast/announce regions.

Zod and React Hook Form must not reach the shared layout chunk. `inquiry.schema.ts` is kept
React-free so the server and the client form can both import it; it then ships only on form routes.

---

## 3. Data flow — reads

```
/products (Server Component)
   → container.products.listActive()          services/container.ts
   → ProductService.listActive()              business rules, ordering
   → ProductRepository.findActive()           explicit column list, never SELECT *
   → supabase (anon key, RLS enforced)
   → toProduct()                              mappers — the single row→domain boundary
   → rendered HTML, cached for 3600s
```

The mapper is the only place a database row shape is converted, which is why the `cost_per_mg` string
coercion needs to exist in exactly one file.

## 4. Data flow — the inquiry write

```
POST /api/inquiries                          route: 4 checks, then hand over
   ├─ isSameOrigin()                         403 on a cross-origin post
   ├─ Idempotency-Key header is a UUID       400 if absent or malformed
   ├─ request.json()                         400 on unparseable input
   ├─ inquirySchema.safeParse()              422 + per-field errors; no price field exists
   │                                         to tamper with. Parsed BEFORE the limiter, so
   │                                         a malformed flood costs no database round trip
   └─ InquiryService.submit()                every business rule lives here
        ├─ honeypot + dwell-time check       201 with orderNumber: null (ADR-021)
        ├─ RateLimitService.checkInquiry()   429 + Retry-After on the 6th hit / 15 min
        │                                    (fails open if the counter is down — ADR-022)
        ├─ ProductRepository.findByIds()     ← the server reads the real prices
        ├─ priceLines()                      computes every subtotal server-side;
        │                                    a missing product is 409, never a silent trim
        ├─ create_inquiry(payload) RPC       atomic: order + N items + 2 pending
        │                                    notification rows, ON CONFLICT DO NOTHING
        └─ NotificationService.dispatch()    AFTER the commit. Cannot rethrow.
             ├─ EmailService (Resend)        → notification_log: sent | failed | skipped
             └─ WhatsAppService (null | Meta) → notification_log: sent | failed | skipped
```

Note where the spam filters sit: **inside the service, not the route.** They are business rules, and
their answer to a bot — an ordinary success — is a business decision (ADR-021). The route only
establishes that a request is well-formed and ours.

Three invariants:

1. **The order is committed before any notification is attempted.** A dead email provider can never
   lose a lead.
2. **The notification runner cannot throw.** Every outcome — including "no credentials configured" —
   is written to `notification_log`, which doubles as a replayable dead-letter list.
3. **Retries only for transient failures** (timeout, 429, 5xx). A 401 will not succeed on a second
   attempt; retrying it only delays the record the operator needs.

Idempotency: the client generates a UUID once per form mount and sends it as `Idempotency-Key`.
`orders.idempotency_key` is `UNIQUE`, the RPC does `ON CONFLICT DO NOTHING` and reads back. A
double-click or a network retry yields one order and one email — the replay path returns
`created: false`, and the service skips dispatch entirely on that branch, so the operator never
receives the same lead twice.

Verified end to end: three POSTs with one key produced one order, one email row with `attempts: 1`,
and the same `PL-` reference all three times.

---

## 5. The disclaimer gate

A client overlay over fully server-rendered content, persisted in `localStorage`. Full rationale in
ADR-009 — the short version is that a cookie gate or a redirect gate would make the site
un-indexable, and indexability is a hard requirement.

The gate never hides page content; it covers it. That is deliberate: a pre-paint script that hid the
page would also hide it from Googlebot, which renders with an empty `localStorage`.

---

## 6. State management

Local state first, then Context, then Zustand — per `CLAUDE.md`. In practice:

| Concern               | Mechanism                                                                  |
| --------------------- | -------------------------------------------------------------------------- |
| Inquiry list          | Zustand + `persist` + `skipHydration`. Cross-page and must survive reload. |
| Gate acknowledgement  | `localStorage`, read by the gate component and a pre-paint script.         |
| Filters, search, sort | URL `searchParams`. Shareable, server-readable, no state library.          |
| Everything else       | Local `useState`.                                                          |

There is no global provider tree beyond the toast portal and the cart hydrator.

### How the inquiry list resolves

The store holds `{ productId, quantity }` and nothing else (ADR-010). Names and prices come from the
catalog the _page_ already read, passed down as props — never a client fetch and never a denormalised
copy in storage (ADR-020).

```
Server Component reads catalog
        │
        ▼
props ──► cart component ──► resolveCartLines(items, catalog) ──► lines + totals
              ▲
              └── useCartStore (IDs + quantities, rehydrated after mount)
```

Consequences worth remembering before adding a surface:

- A page that displays money must pass its catalog in. The mobile order bar therefore lives on
  `/products` and `/cart`, not on the detail page, which holds one product.
- `reconcile` deletes lines missing from the catalog it is given, so it runs **only** on `/cart`, where
  the catalog is the complete active set.
- Controls stay disabled until `hasHydrated`; a click landing mid-rehydration would be overwritten by
  the merge.

---

## 7. Directory map

| Path                     | Contains                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`               | Routes, layouts, metadata, Route Handlers. No business logic.                                                                      |
| `src/components/ui/`     | Generic primitives (shadcn) + `LatticeMark`, `HexFrame`. No business logic.                                                        |
| `src/components/layout/` | Compliance strip, header, nav, footer, container, section.                                                                         |
| `src/components/shared/` | Reused across features: empty/error states, skeletons, skip link.                                                                  |
| `src/features/<name>/`   | Self-contained feature: components, services, types, mappers, utils.                                                               |
| `src/services/`          | Cross-feature services and `container.ts`, the one composition root.                                                               |
| `src/lib/`               | Integrations and cross-cutting concerns: supabase, resend, whatsapp, logger, errors, http, resilience, security, validations, env. |
| `src/store/`             | Zustand stores.                                                                                                                    |
| `src/hooks/`             | Reusable client hooks.                                                                                                             |
| `src/types/`             | Cross-cutting types: `api.ts`, `result.ts`, generated `database.types.ts`.                                                         |
| `src/utils/`             | Pure functions. No React, no Next, no side effects.                                                                                |
| `src/constants/`         | `site.ts`, `routes.ts`, `business.ts`, `messages.ts`. No magic strings elsewhere.                                                  |
| `supabase/`              | `config.toml`, `migrations/`, `seed.sql`.                                                                                          |

There is no `proxy.ts`. Nothing needs to run before render, and adding one would cost an invocation
per request for no benefit.

---

## 8. Version-specific notes

This is Next.js **16.3.0**, which differs from older App Router conventions in ways that matter:

- `params` and `searchParams` are **Promises**. Global generated types `PageProps<'/route'>`,
  `LayoutProps<'/'>` and `RouteContext<'/api/x/[id]'>` are available without import.
- `error.tsx` receives **`retry`**, not `reset`.
- Middleware is **`proxy.ts`** with an exported `proxy()` function. `middleware.ts` is deprecated.
- `next/image`: **`priority` is deprecated** in favour of `preload`; `images.domains` is deprecated in
  favour of `remotePatterns`; `minimumCacheTTL` now defaults to 4 hours.
- **Turbopack is the default for `next build`.** A `webpack` key in `next.config.ts` fails the build.
- `revalidateTag(tag, profile)` **requires** the second `cacheLife` argument.
- `next lint` is removed; `next build` no longer lints. Run `npm run lint` separately.

Tailwind is **v4**: CSS-first configuration via `@theme` in `globals.css`. There is no
`tailwind.config.ts`.

Zod is **v4**: `z.email()` not `z.string().email()`, `error:` not `message:`, `.issues` not `.errors`.

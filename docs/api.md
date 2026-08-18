# API — PeptoLogics

> All four endpoints are implemented and documented in full.

---

## Response envelope

Every endpoint returns one of two shapes. Consistency matters more than any individual field choice.

**Success**

```json
{
  "success": true,
  "message": "Inquiry submitted successfully.",
  "data": {}
}
```

**Failure**

```json
{
  "success": false,
  "message": "Please check the highlighted fields and try again.",
  "code": "VALIDATION_FAILED",
  "errors": [{ "field": "email", "message": "Enter a valid email address." }]
}
```

`message` is always safe to show a customer. `code` is stable and safe to branch on. Stack traces,
SQL, table names and internal paths never appear in a response.

## Status codes

| Code | Meaning                                                  |
| ---- | -------------------------------------------------------- |
| 200  | Read succeeded                                           |
| 201  | Inquiry created                                          |
| 403  | Cross-origin request rejected                            |
| 404  | Resource not found                                       |
| 409  | A product on the inquiry is no longer available          |
| 422  | Validation failed, or the inquiry list was empty         |
| 429  | Rate limited. Includes a `Retry-After` header in seconds |
| 500  | Unexpected server error                                  |

## Endpoints

| Method | Path              | Purpose                                                           | Auth                                       |
| ------ | ----------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| `GET`  | `/api/health`     | Liveness plus a database reachability check. No sensitive detail. | none                                       |
| `GET`  | `/api/products`   | Active catalog.                                                   | none                                       |
| `POST` | `/api/inquiries`  | Create an inquiry.                                                | none, but same-origin + rate limited       |
| `POST` | `/api/revalidate` | Purge the catalog cache after a price change.                     | `Authorization: Bearer $REVALIDATE_SECRET` |

Detail — request shape, validation rules, every error response — is documented per endpoint below.

---

## `GET /api/health`

Liveness plus a real dependency check. Runs an actual one-row catalog query rather than a ping,
because that exercises the key, RLS, and the connection — which is what breaks in production.

```json
{
  "success": true,
  "message": "Service is healthy.",
  "data": {
    "status": "ok",
    "database": "reachable",
    "latencyMs": 41,
    "channels": {
      "email": "not_configured",
      "inquiryWrites": "available"
    }
  }
}
```

`channels` reports configuration surface, not secrets — useful for confirming a deployment picked up
its environment variables. Returns `503` with code `DEGRADED` if the database is unreachable, and
`UNAVAILABLE` on an unexpected failure. No versions, connection strings, or error messages are
exposed.

## `GET /api/products`

The active catalog. Not used by the site itself — pages read through the service layer in Server
Components, which avoids an HTTP hop to ourselves. This exists for monitoring and any future external
consumer.

| Query param | Values                                                            | Default       |
| ----------- | ----------------------------------------------------------------- | ------------- |
| `sort`      | `recommended`, `name-asc`, `price-asc`, `price-desc`, `value-asc` | `recommended` |
| `search`    | free text, matched against name in SQL, capped at 60 chars        | none          |

An unrecognised `sort` falls back to `recommended` rather than erroring — the value comes from a URL
and is untrusted. `search` is sanitised for invisible characters and its `ilike` wildcards (`%`, `_`,
`\`) are escaped, so searching for `%` matches nothing rather than everything.

Money is returned as `priceCents` (integer). `costPerMg` is a number, coerced once from the string
PostgREST sends for `numeric` columns, and is display-only. `isBlend` products should not show a
cost-per-mg figure — it divides price by total milligrams across several peptides and is not
comparable to a single-peptide product.

## Product pages and HTTP status

`/products/[slug]` returns a real `404` for an unknown slug, because the segment sets
`dynamicParams = false`. With `true`, Next renders and caches the not-found page and returns `200` — a
soft 404. See ADR-014.

## `POST /api/inquiries`

Creates an inquiry: one `orders` row, one `order_items` row per product, and one `notification_log` row
per notification channel — all in a single transaction (ADR-004). Both notifications are dispatched
after the commit and cannot affect the response.

### Headers

| Header            | Required | Notes                                                                 |
| ----------------- | -------- | --------------------------------------------------------------------- |
| `Content-Type`    | yes      | `application/json`                                                    |
| `Idempotency-Key` | yes      | UUID, generated once per form mount. A replay returns the same order. |

`Origin`, when present, must match `NEXT_PUBLIC_SITE_URL`, otherwise the request is refused with `403`.

### Request body

```json
{
  "customer": {
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "phone": "+1 555 010 2030",
    "address": "12 Analytical Engine Way",
    "apartment": "Suite 4",
    "city": "Cambridge",
    "state": "MA",
    "zipCode": "02139",
    "notes": "Please send the COA for the current lot."
  },
  "items": [{ "productId": "uuid", "quantity": 2 }],
  "honeypot": "",
  "formStartedAt": 1754500000000,
  "ruoAcknowledgedAt": "2026-08-07T10:15:00.000Z"
}
```

**There is no price field anywhere in this schema.** Prices come from `products.price_cents`, read
server-side (ADR-005). Extra keys — `unitPriceCents`, `subtotalCents`, anything else — are stripped by
Zod and cannot influence what is stored. Verified: a payload claiming `1` cent for a $60 vial persisted
`6000`.

### Validation

| Field                | Rule                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| `customer.name`      | required, 1–200 chars after sanitising                                       |
| `customer.email`     | required, valid address, 5–254 chars, lowercased on the way in               |
| `customer.phone`     | required, 7–32 chars; digits, `+`, and common separators kept                |
| `customer.address`   | required, 1–300 chars                                                        |
| `customer.apartment` | optional, ≤ 120 chars; empty becomes absent                                  |
| `customer.city`      | required, 1–120 chars                                                        |
| `customer.state`     | required, 2–100 chars                                                        |
| `customer.zipCode`   | required, 3–20 chars                                                         |
| `customer.notes`     | optional, ≤ 2000 chars; line breaks preserved, blank runs collapsed          |
| `items`              | 1–25 entries, each `productId` a UUID and unique, `quantity` an integer 1–99 |
| `honeypot`           | optional; **must be empty** — see below                                      |
| `formStartedAt`      | optional epoch ms; absent or under 3s before now is treated as automated     |
| `ruoAcknowledgedAt`  | optional ISO 8601 datetime; stored on the order                              |

Every text field is trimmed and stripped of control, zero-width and exotic-space characters, then
re-measured — so 200 zero-width characters do not pass as a name. The bounds mirror the CHECK
constraints on `orders` exactly.

### Responses

**`201` — created**

```json
{
  "success": true,
  "message": "Your inquiry has been received.",
  "data": { "orderNumber": "PL-001004", "created": true }
}
```

`created: false` with an `orderNumber` means the key was replayed: the original order is returned and no
second notification is sent. `orderNumber: null` means the submission was suppressed as automated —
deliberately indistinguishable from success over the wire (ADR-021).

**Failures**

| Status | `code`                | When                                                                  |
| ------ | --------------------- | --------------------------------------------------------------------- |
| `400`  | `VALIDATION_FAILED`   | `Idempotency-Key` missing or not a UUID; body not JSON                |
| `403`  | `FORBIDDEN`           | `Origin` is not this site                                             |
| `409`  | `PRODUCT_UNAVAILABLE` | A requested product is not active — the whole inquiry is refused      |
| `422`  | `VALIDATION_FAILED`   | Field errors, with `errors[]` keyed by dotted path (`customer.email`) |
| `429`  | `RATE_LIMITED`        | 6th submission in 15 minutes from one hashed IP; sends `Retry-After`  |
| `500`  | `PERSISTENCE_FAILED`  | The write failed. Nothing partial was stored                          |
| `500`  | `UNEXPECTED`          | Anything else. Detail goes to the logs, never to the response         |

A `409` refuses the submission rather than silently dropping the unavailable line: quoting a customer for
less than they asked for is worse than asking them to review the list.

### Rate limiting

Five submissions per 15-minute fixed window, keyed on a salted SHA-256 of the client IP — the raw
address is never stored. Counted after the spam filters and before pricing, so a bot costs nothing and a
replayed key still counts. If the counter itself is unreachable the check fails **open** (ADR-022).

### Spam handling

A filled honeypot, a missing `formStartedAt`, or a dwell under 3 seconds returns `201` with
`orderNumber: null`, persists nothing, and sends nothing. Each is logged with its reason and no customer
data.

### Notification behaviour

`notification_log` gets a `pending` row per channel inside the order's transaction, then the outcome.
Both channels are email (ADR-023); there are two of them because they have different readers and fail
independently (ADR-027):

| Channel          | Recipient                  | Reply-to                 | Sender                                                  |
| ---------------- | -------------------------- | ------------------------ | ------------------------------------------------------- |
| `email`          | `INQUIRY_NOTIFICATION_TO`  | the customer             | `INQUIRY_NOTIFICATION_FROM`                             |
| `customer_email` | the address on the inquiry | first internal recipient | `CUSTOMER_CONFIRMATION_FROM`, falling back to the above |

The two run concurrently and each records its own outcome:

| Status    | Meaning                                                                  |
| --------- | ------------------------------------------------------------------------ |
| `sent`    | Provider accepted it; `provider_message_id` recorded                     |
| `failed`  | Provider rejected or timed out after 3 attempts on retryable errors only |
| `skipped` | Channel not configured — expected, not an incident                       |
| `pending` | Dispatch never completed. This is the dead-letter list                   |

A failed or skipped channel still returns `201`. The lead is saved either way, which is the entire point
of committing before notifying — and a confirmation that never reached the customer must not tell them
their inquiry failed when it did not.

A replayed `Idempotency-Key` notifies nobody a second time. The order already exists and was already
dispatched, so a replay would put a duplicate lead in the inbox and a duplicate confirmation in the
customer's.

## `POST /api/revalidate`

Purges the catalog cache. The catalog is statically rendered with a one-hour ISR window, which is the
right default and the wrong latency for a price correction — this makes the refresh immediate.

**Auth:** `Authorization: Bearer $REVALIDATE_SECRET`, compared in constant time. With no secret
configured the endpoint is closed, not open.

**Body:** optional. `{ "slug": "retatrutide-10mg" }` also purges that product page.

```bash
curl -X POST https://peptologics.com/api/revalidate \
  -H "Authorization: Bearer $REVALIDATE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"slug":"retatrutide-10mg"}'
```

`/` and `/products` are **always** purged, with or without a slug. A price shows in three places — the
detail page, the catalog row, the home page's featured strip — and refreshing one without the others is
how a site ends up quoting two different prices for the same product.

| Status | `code`               | When                                          |
| ------ | -------------------- | --------------------------------------------- |
| `200`  | —                    | Purged. `data.revalidated` lists the paths    |
| `401`  | `UNAUTHORISED`       | Missing, malformed or wrong bearer token      |
| `405`  | `METHOD_NOT_ALLOWED` | `GET`, so a browser visit gets a clear answer |
| `422`  | `VALIDATION_FAILED`  | `slug` present but not a valid slug           |

Adding a **new** product needs a redeploy, not a purge: `/products/[slug]` sets `dynamicParams = false`,
so a slug absent at build time 404s until `generateStaticParams` runs again (ADR-014).

---

## SEO surfaces

| Path                               | What it is                                                              |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `/sitemap.xml`                     | 9 static routes + 12 product URLs with real `lastmod` from `updated_at` |
| `/robots.txt`                      | Allows everything except `/cart`, `/inquiry*`, `/not-eligible`, `/api/` |
| `/opengraph-image`                 | 1200×630 brand card, generated                                          |
| `/products/[slug]/opengraph-image` | Per-product card with vial size and list price, prerendered for all 12  |
| `/icon`, `/apple-icon`             | 32×32 and 180×180, generated from the brand colours                     |

Structured data: `Organization` and `WebSite` site-wide, `FAQPage` on the home page built from the same
array the page renders, `Product` + `BreadcrumbList` on each product page. `Product` carries **no
`offers`** — nothing here is purchasable and claiming otherwise would put a "buy now" price into search
results for a research reagent (ADR-012).

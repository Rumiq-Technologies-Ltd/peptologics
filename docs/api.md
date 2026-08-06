# API — PeptoLogics

> **Status: skeleton.** Endpoint detail is filled in as each one is built (Phases 2 and 5).

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

Detail — request shape, validation rules, every error response — is documented per endpoint as it is
implemented.

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
      "whatsapp": "not_configured",
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

## `POST /api/inquiries` — notes that apply now

- **`Idempotency-Key` header, required.** A client-generated UUID, stable for the lifetime of one form
  mount. Replaying the same key returns the original order without sending a second notification.
- **No price fields are accepted.** The payload carries `{ productId, quantity }` only. Prices are
  read from the database server-side (ADR-005). Sending a price is not rejected — there is simply no
  field for it in the schema.
- **Honeypot and dwell time.** A filled honeypot or a sub-3-second submission returns `201` with
  nothing persisted, so an automated client cannot distinguish success from rejection.
- **Notifications never affect the response.** The order is committed first. Email and WhatsApp
  outcomes are recorded in `notification_log`; a failed send still returns `201`.

# Database — PeptoLogics

**DynamoDB**, one table per environment, in `us-east-1` (ADR-035). Supabase PostgreSQL is still the
live store until the cutover; the repositories for both sit behind the same interfaces and
`INQUIRY_DATA_STORE` (`supabase` | `dynamodb`, unset means `supabase`) chooses. The Supabase schema is
in [database-supabase-legacy.md](./database-supabase-legacy.md).

Design rationale: ADR-035 (single-table design) and ADR-036 (catalog filtering in the repository) in
[decisions.md](./decisions.md). Older ADRs 001–004 and 011 describe the Postgres versions of the
same invariants.

---

## Tables and indexes

| Table                 | Used by                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `peptologics-dev`     | Developers' own machines only. There is no dev site. Products only, never customer data |
| `peptologics-staging` | The Amplify `staging` site. Seeded with a copy of prod data (D2)                        |
| `peptologics-prod`    | The Amplify `main` site                                                                 |

All three are identical: on-demand billing; key `PK` (S) + `SK` (S); TTL attribute `expires_at`.
Never point a local machine at `peptologics-prod`.

| Index  | Keys               | Projection | Serves                                             |
| ------ | ------------------ | ---------- | -------------------------------------------------- |
| `GSI1` | `GSI1PK`, `GSI1SK` | ALL        | The catalog, and orders listed by month            |
| `GSI2` | `GSI2PK`           | ALL        | A product by slug                                  |
| `GSI3` | `GSI3PK`, `GSI3SK` | ALL        | Notifications still `pending` or `failed` (sparse) |

Attribute names are the old column names (`snake_case`); a null column is an absent attribute. Key
formats live in one file, `src/lib/dynamodb/entities.ts`, shared by the repositories and the migration
script.

## Entities

| Entity               | PK                               | SK                     | Other keys and notes                                                                                                                                                                                        |
| -------------------- | -------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product              | `PRODUCT#<id>`                   | `META`                 | `GSI1PK=PRODUCTS`, `GSI1SK=<sort_order, 6 digits>#<name>`, `GSI2PK=SLUG#<slug>`. `cost_per_mg` is computed on write. `version` (optimistic lock; absent = 0), `previous_slugs` (list)                       |
| Slug guard           | `SLUG#<slug>`                    | `GUARD`                | Written with a product under `attribute_not_exists`, to make a slug unique. `entity=slug_guard`, `product_id`                                                                                               |
| Retired slug         | `SLUG#<slug>`                    | `GUARD`                | The same item after the admin renames the product (D26): `entity=slug_redirect`, `product_id`, `retired_at`, `GSI1PK=SLUG_REDIRECTS`, `GSI1SK=<slug>`. Never deleted, so no other product can take the slug |
| Rebuild state        | `BUILD#rebuild-hook`             | `META`                 | `last_triggered_at`, `pending`. The two-minute window for the site build webhook (ADR-039)                                                                                                                  |
| Order                | `ORDER#<id>`                     | `META`                 | `GSI1PK=ORDERS#<yyyy-mm UTC>`, `GSI1SK=<created_at ISO>`: newest-first per month, for staff and the future admin page                                                                                       |
| Order item           | `ORDER#<id>`                     | `ITEM#<product_id>`    | The sort key makes one line per product automatic                                                                                                                                                           |
| Notification         | `ORDER#<id>`                     | `NOTIF#<channel>`      | `channel` is `email` or `customer_email`. `GSI3PK=NOTIF_OPEN`, `GSI3SK=<created_at>#<order_id>#<channel>` only while open                                                                                   |
| Idempotency guard    | `IDEMP#<idempotency_key>`        | `GUARD`                | Holds `order_id` and `order_number`, so a replay is answered with one read                                                                                                                                  |
| Order-number counter | `COUNTER#order_number`           | `META`                 | `seq`. Advanced with `SET seq = if_not_exists(seq, 999) + 1`, so a fresh table's first order is `PL-001000`                                                                                                 |
| Admin audit entry    | `AUDIT#<yyyy-mm>`                | `<ISO timestamp>#<id>` | `actor_email`, `actor_role`, `action`, `target`, `request_id`. Append-only; one month is one Query (ADR-038, [admin.md](./admin.md))                                                                        |
| Rate-limit bucket    | `RL#<bucket_key>#<window_start>` | `META`                 | `hits`, advanced by `ADD`. `expires_at` (epoch seconds) is the TTL attribute                                                                                                                                |

## Access patterns

| Need                          | How                                                                    | Code                                                  |
| ----------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| Catalog, filter, sort, search | One Query on `GSI1PK=PRODUCTS`, then filter and sort in code (ADR-036) | `product.repository.dynamodb.ts`, `product.query.ts`  |
| Featured, by ids, slug list   | The same catalog Query, filtered in code                               | `product.repository.dynamodb.ts`                      |
| Product by slug               | Query `GSI2` on `SLUG#<slug>`                                          | `product.repository.dynamodb.ts`                      |
| Create an inquiry             | Read the guard, advance the counter, one `TransactWriteItems`          | `order.repository.dynamodb.ts`                        |
| Record a notification outcome | `UpdateItem`; `sent`/`skipped` remove the `GSI3` keys                  | `notification.repository.dynamodb.ts`                 |
| Dead-letter list (not sent)   | Query `GSI3PK=NOTIF_OPEN`                                              | Not used by the app yet; for staff and the admin page |
| Orders, newest first          | Query `GSI1PK=ORDERS#<yyyy-mm>`, descending                            | For the admin page (D4)                               |
| Admin product list            | The same catalog Query, every status                                   | `productAdmin.repository.dynamodb.ts`                 |
| Retired slugs (for the build) | Query `GSI1PK=SLUG_REDIRECTS`                                          | `product.repository.dynamodb.ts`                      |
| Redirect target of a slug     | `GetItem` the guard, then `GetItem` its product                        | `product.repository.dynamodb.ts`                      |
| Rate limit                    | One `UpdateItem ... ADD hits 1 ... ReturnValues UPDATED_NEW`           | `rate-limit.repository.dynamodb.ts`                   |
| Health                        | The catalog read (needs `Query` on `GSI1`)                             | `src/app/api/health/route.ts`                         |

## Invariants and where each now lives

DynamoDB accepts any item, so what Postgres enforced with CHECK constraints, foreign keys and
functions is enforced in code. The write path refuses an order that breaks any rule below
(`order.invariants.ts`, one unit test per rule) before it touches the table; the Zod schema still
produces the friendly field errors earlier.

| Postgres guarantee                                                  | Now enforced by                                                                                                                                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One order, its N items and 2 `pending` notifications: all or none   | One `TransactWriteItems` (at most 29 items; the limit is 100)                                                                                                                                               |
| Repeated `idempotency_key` returns the original, writes nothing     | Guard item `IDEMP#<key>` with `attribute_not_exists(PK)`. A concurrent duplicate that loses the race gets `TransactionCanceledException` on item 0 and the winner's order is returned with `created: false` |
| `order_number` = `PL-` + 6 digits, from 1000, gaps allowed          | The counter item. It advances before the transaction, so a failed write leaves a gap (accepted)                                                                                                             |
| One order line per product (`order_items_one_row_per_product`)      | Sort key `ITEM#<product_id>`, plus the duplicate check in `order.invariants.ts`                                                                                                                             |
| `orders_*_length`, `orders_email_format`, `orders_email_length`     | `order.invariants.ts` (and the Zod schema)                                                                                                                                                                  |
| `order_items_quantity_range` (1–99)                                 | `order.invariants.ts` (and the Zod schema)                                                                                                                                                                  |
| `order_items_unit_price_positive`, `order_items_strength_positive`  | `order.invariants.ts`                                                                                                                                                                                       |
| `order_items_subtotal_matches` (`unit_price × quantity`)            | `order.invariants.ts`                                                                                                                                                                                       |
| `orders_subtotal_nonnegative`, subtotal equals the sum of its lines | `order.invariants.ts`                                                                                                                                                                                       |
| `orders_discount_nonnegative`, `orders_discount_within_subtotal`    | `order.invariants.ts`                                                                                                                                                                                       |
| `orders_status_valid`, notification status and channel enums        | Types in the repositories; new orders are always `new`, new notifications always `pending`                                                                                                                  |
| `notification_log_error_length` (1000)                              | Truncated in `notification.repository.dynamodb.ts`                                                                                                                                                          |
| One notification per (order, channel)                               | Sort key `NOTIF#<channel>`                                                                                                                                                                                  |
| Slug unique, `^[a-z0-9]+(-[a-z0-9]+)*$`                             | Slug guard item; the pattern is checked when a product item is built (`entities.ts`)                                                                                                                        |
| `cost_per_mg` generated, read-only                                  | Computed in `buildProductItems`, at full precision, never taken from input                                                                                                                                  |
| `strength_unit` is `mg` or `ml`; `price_cents` integer              | Checked in `buildProductItems`                                                                                                                                                                              |
| Only `status='active' AND deleted_at IS NULL` is public (RLS)       | `isPublicProduct` in `product.query.ts`, applied to every catalog read                                                                                                                                      |
| Customer PII unreadable with any browser-reachable key              | No browser path to the table. The app reaches it only through its IAM role, scoped to one table                                                                                                             |
| Foreign key `order_items.product_id` (RESTRICT)                     | Not enforced. Order lines keep a snapshot (name, slug, strength) and the product id; products are retired with `status='archived'`, never deleted                                                           |
| Atomic rate-limit increment-and-test (`check_rate_limit`)           | One `UpdateItem ADD hits 1` returning the new count                                                                                                                                                         |
| Soft deletes                                                        | `deleted_at` is kept and copied; nothing in the app deletes a row                                                                                                                                           |

## Money

Integer cents, in attributes suffixed `_cents`, exactly as before (ADR-002). `cost_per_mg` and
`strength_mg` are display figures stored as numbers; they never enter money arithmetic.

## Rate limiting

A fixed window per salted-hash bucket. The window start is part of the key, so a new window is a new
item and nothing depends on old items being deleted. TTL on `expires_at` (window end plus one hour)
cleans up, lazily: DynamoDB can take up to about 48 hours to delete an expired item, which is
harmless.

## IAM the app role needs

`dynamodb:GetItem`, `PutItem`, `UpdateItem`, `Query`, `TransactWriteItems`, `ConditionCheckItem` and
`DescribeTable`, on the one table and `table/<name>/index/*` only. The app never scans. Every admin
product change is one `TransactWriteItems` holding the product, its slug guards and its audit item; the
admin adds no new table permission.

## Migrating data from Supabase

`scripts/migrate-supabase-to-dynamodb.ts`. It runs on plain Node (which runs TypeScript natively):

```bash
node --env-file=.env.local scripts/migrate-supabase-to-dynamodb.ts --table <name> [options]
```

| Option                | Meaning                                                                           |
| --------------------- | --------------------------------------------------------------------------------- |
| `--dry-run`           | The default. Reads Supabase, reports, writes nothing, needs no AWS credentials    |
| `--apply`             | Writes. Repeatable: items are keyed on the original ids                           |
| `--products-only`     | The catalog only. Use this for `peptologics-dev`, which never holds customer data |
| `--since <ISO>`       | Delta pass: rows created or updated after that time                               |
| `--counter-floor <n>` | Raise the order-number counter to at least `n`. Never lowers it                   |
| `--allow-prod`        | Required for a table named `*prod*`. Only the control chat passes it              |

It copies everything, including soft-deleted rows (D9), keeps `id`, `order_number`, `created_at` and
`updated_at`, and prints a verification report: counts, the sum of `subtotal_cents`, a field-by-field
check of 5 random orders, and `cost_per_mg` for every product. It prints no customer values.

Zero-downtime cutover (D6), run by the control chat:

1. Full copy to `peptologics-prod`, ahead of time. Verify.
2. Set the counter well above the highest Supabase number: `--counter-floor <max + 100>`.
3. Deploy with `INQUIRY_DATA_STORE=dynamodb`. Amplify switches traffic atomically.
4. Delta copy: `--since <time of step 1>`.
5. Supabase goes read-only and stays as the fallback for 2 weeks (D7).

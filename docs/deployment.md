# Deployment — PeptoLogics

Vercel (Next.js) + Supabase (PostgreSQL) + Resend (email).

Domain: **peptologics.com**. Registrar access is with the client; DNS is changed by hand at the
registrar, not by Vercel (see [DNS](#dns)).

---

## Environments

| Environment | Trigger             | Supabase        | `NEXT_PUBLIC_SITE_URL`     | Indexed |
| ----------- | ------------------- | --------------- | -------------------------- | ------- |
| Development | local `npm run dev` | the one project | `http://localhost:3000`    | n/a     |
| Preview     | any pushed branch   | the one project | leave unset → Vercel's URL | **no**  |
| Production  | `main`              | the one project | `https://peptologics.com`  | yes     |

> **One Supabase project serves all three.** A preview deployment and a developer's laptop write
> orders to the same database production reads. That is acceptable today — there are no real customer
> records yet and the catalog is read-only from the browser — but it stops being acceptable the moment
> real leads arrive. Two options when that happens, in order of preference:
>
> 1. Create a second Supabase project for preview/development and point the non-production
>    environments at it. Costs one more project; nothing in the code changes.
> 2. Use Supabase branching, which gives ephemeral databases per Git branch.
>
> Recorded as an open question in [decisions.md](./decisions.md).

Preview deployments must never be indexed. They are covered already: `robots.ts` and every page's
metadata derive from `NEXT_PUBLIC_SITE_URL`, and Vercel sets `x-robots-tag: noindex` on preview
deployments by default. **Do not** set `NEXT_PUBLIC_SITE_URL` to the production domain in the Preview
environment — that would advertise the production sitemap from a staging build.

## Pre-deploy gate

All of these must pass. A failure blocks the deploy.

```bash
npm run verify      # typecheck + lint + format + unit tests + build
npm run test:e2e    # 11 Playwright specs against a production build
```

---

## First-time Vercel setup

Do these in order. Steps 1–4 need no DNS; the domain only enters at step 5.

### 1. Import the repository

Vercel dashboard → **Add New → Project** → import `Rumiq-Technologies-Ltd/peptologics`.

Framework preset **Next.js** is detected. Leave the build command, output directory and install
command at their defaults — this repo needs no overrides.

### 2. Set the environment variables

Project → **Settings → Environment Variables**. Add each one to the environments marked below.

| Variable                    | Production | Preview | Value                                                                         |
| --------------------------- | ---------- | ------- | ----------------------------------------------------------------------------- |
| `SUPABASE_URL`              | ✓          | ✓       | `https://<project-ref>.supabase.co`                                           |
| `SUPABASE_ANON_KEY`         | ✓          | ✓       | Supabase → Settings → API → `anon` / publishable key                          |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓          | ✓       | Supabase → Settings → API → `service_role`. **Mark as sensitive.**            |
| `NEXT_PUBLIC_SITE_URL`      | ✓          | ✗       | `https://peptologics.com` — production only, no trailing slash                |
| `RESEND_API_KEY`            | ✓          | ✓       | Resend → API Keys. **Sensitive.**                                             |
| `INQUIRY_NOTIFICATION_FROM` | ✓          | ✓       | `PeptoLogics <inquiries@peptologics.com>` — note the space before `<`         |
| `INQUIRY_NOTIFICATION_TO`   | ✓          | ✓       | Where inquiries land. Comma-separated for several recipients                  |
| `NEXT_PUBLIC_CONTACT_EMAIL` | ✓          | ✓       | Public address shown in the footer and on the contact page                    |
| `REVALIDATE_SECRET`         | ✓          | ✓       | 24 random bytes hex. **Sensitive.** See below                                 |
| `RATE_LIMIT_SALT`           | ✓          | ✓       | 24 random bytes hex. **Sensitive.** Changing it resets all rate-limit windows |

Generate the two secrets:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Two production guardrails are enforced by `src/lib/env.ts` and will **fail the build** rather than
deploy something half-configured:

- `SUPABASE_SERVICE_ROLE_KEY` is required when `NODE_ENV=production`.
- `RATE_LIMIT_SALT` must not be the development default.

### 3. Deploy to preview and check it

Push any branch, or use the **Deploy** button. Then, against the preview URL:

```bash
curl -s https://<preview-url>/api/health | jq
```

Expect `database: "reachable"` and `channels.email: "configured"`.

### 4. Promote to production

Merge to `main`. Vercel builds and promotes automatically.

### 5. Add the domain

Project → **Settings → Domains** → add `peptologics.com`. Add `www.peptologics.com` too; Vercel will
offer to redirect one to the other — **redirect `www` → apex**, because every canonical URL, the
sitemap and the structured data all use the bare domain.

Vercel then shows the exact DNS records to create. Use what the dashboard shows for your domain; it is
authoritative and the values below are the general ones.

---

## DNS

Two records at the registrar. **Delete or replace any existing A/CNAME on the same names first** —
leaving an old host's A record in place is the usual reason a domain never verifies.

| Type    | Name / Host       | Value                  | TTL    |
| ------- | ----------------- | ---------------------- | ------ |
| `A`     | `@` (apex, blank) | `76.76.21.21`          | `3600` |
| `CNAME` | `www`             | `cname.vercel-dns.com` | `3600` |

Notes that matter:

- **Never CNAME the apex.** It is invalid DNS wherever the zone has other records at the root (it
  will, once email is set up). If the registrar offers `ALIAS` or `ANAME` at the apex, that is fine
  and preferable — point it at `cname.vercel-dns.com`.
- Nameserver delegation to Vercel is the alternative to both records. It gives Vercel full control of
  the zone, which is simpler _if_ Vercel also manages the mail records. With Resend sending mail for
  the domain, keeping DNS at the registrar is the lower-risk choice.
- Propagation is usually minutes and can be up to 48 hours. Check with:

```bash
nslookup peptologics.com
nslookup www.peptologics.com
```

Vercel issues the TLS certificate automatically once the records resolve. Nothing to configure.

### Resend, in the same zone

Resend needs its own records on `peptologics.com` before mail can be sent from the domain:

1. Resend → **Domains → Add Domain** → `peptologics.com`.
2. Add every record it lists at the registrar — typically a DKIM `TXT` (often on a
   `resend._domainkey` name), an SPF `TXT` on the apex, and sometimes an `MX` for a bounce subdomain.
3. Wait for Resend to report **Verified**.
4. Only then set `INQUIRY_NOTIFICATION_FROM` to an address on the domain.

> **Current state: not verified.** The sender is Resend's sandbox, `onboarding@resend.dev`, which
> delivers **only to the Resend account owner's inbox**. Production must not ship on it — real
> inquiries would silently fail to reach anyone else. This is the last blocking item before launch.

---

## Security headers

Set in [`next.config.ts`](../next.config.ts), not `vercel.json`, so they apply to `next start` and to
any future host, and so a change to them goes through review.

| Header                       | Value                                                  |
| ---------------------------- | ------------------------------------------------------ |
| `Content-Security-Policy`    | `default-src 'self'` + the directives listed below     |
| `Strict-Transport-Security`  | `max-age=63072000; includeSubDomains; preload`         |
| `X-Content-Type-Options`     | `nosniff`                                              |
| `X-Frame-Options`            | `DENY`                                                 |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                      |
| `Permissions-Policy`         | camera, microphone, geolocation, payment, usb all `()` |
| `Cross-Origin-Opener-Policy` | `same-origin`                                          |

`X-Powered-By` is suppressed.

**`script-src` includes `'unsafe-inline'`, deliberately.** A nonce would have to be generated per
request, which makes every page dynamic and discards the static prerendering the whole site is built
on; the disclaimer gate's pre-paint script also has to run before hydration, so it cannot wait for
React to attach a nonce. A hash-based policy fails on the per-page JSON-LD. What the policy still
buys is real: no third-party origin can load anything, `object-src 'none'`, `base-uri 'self'` (an
injected `<base>` cannot repoint relative URLs), `form-action 'self'` (an injected form cannot post
customer details elsewhere), and `frame-ancestors 'none'` (the gate and the inquiry form cannot be
framed). Full reasoning is in the config's own comment.

Verify after deploy:

```bash
curl -sI https://peptologics.com | grep -Ei "content-security|strict-transport|x-frame|referrer|permissions"
```

---

## Database migrations

Applied through migrations only. Never edit production schema by hand.

> **Read this before running `supabase db push`.** The remote migration history was written by the
> Supabase MCP tooling, so its versions (`20260806073131_helpers`, …) do **not** match the local
> filenames (`20260806100000_helpers.sql`, …). A plain `db push` would treat every local file as new
> and try to re-create tables that already exist. The schema is identical; only the ledger disagrees.
>
> Reconcile once, before the next schema change, by telling Supabase the local versions are already
> applied:
>
> ```bash
> npx supabase link --project-ref pmbatptoffscqtnfmhbz
> npx supabase migration list            # shows local vs remote side by side
> npx supabase migration repair --status applied <local-version>   # once per existing file
> ```
>
> After that, `db push` behaves normally for new migrations. Until then, apply schema changes the way
> the existing ones were applied — through the MCP tooling or the Supabase SQL editor — and commit the
> matching `.sql` file so the repo stays the record of truth.

All twelve migrations are applied to project `pmbatptoffscqtnfmhbz`, including
`create_inquiry_email_only` from the WhatsApp removal.

## Adding a product to the catalog

Inserting a row into `products` is **not** enough to make its page reachable. `/products/[slug]` uses
`dynamicParams = false`, so any slug not present at build time returns a real 404 (ADR-014). After
inserting a product:

1. Insert the row (via a seed edit and re-run, or Supabase Studio).
2. **Trigger a redeploy** so `generateStaticParams` picks up the new slug. A Vercel Deploy Hook called
   from a Supabase Database Webhook on `products` INSERT would automate this.
3. `POST /api/revalidate` refreshes the catalog listing, but does **not** create the new detail page.

Editing an existing product — including its price — needs no redeploy. It propagates within the hour,
or immediately with:

```bash
curl -X POST https://peptologics.com/api/revalidate \
  -H "Authorization: Bearer $REVALIDATE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"slug":"retatrutide-10mg"}'
```

`/` and `/products` are purged too, with or without a slug — a price appears in three places and they
must not disagree. Full contract in [api.md](./api.md).

## Notification channels

**Email is the only channel.** WhatsApp was removed at the client's request — see ADR-023. There are
no Meta credentials to obtain, no template to get approved, and nothing in the deploy checklist that
waits on Meta.

If it is ever wanted back, the work is an adapter plus one entry in `NotificationService.dispatch`:
`notification_log` and its repository are already channel-generic, and the table's CHECK constraint
still permits a `whatsapp` channel value.

Watch `notification_log` for the dead-letter list — anything left `pending` or `failed` is a lead
nobody was told about:

```sql
select order_id, channel, status, attempts, error_message, created_at
  from notification_log
 where status in ('pending', 'failed')
 order by created_at desc;
```

---

## Rollback

**Deployment rollback** — instant, and the first move in any production incident:

1. Vercel → **Deployments** → find the last known-good deployment → **⋯ → Promote to Production**.
2. Investigate afterwards. Never patch production directly.
3. Fix on a branch, verify, merge.

Because every route is either static or a stateless function, promoting an older build is genuinely
safe: there is no in-flight session state to lose and no client-side migration to unwind. The cart
lives in the visitor's own `localStorage` and its stored schema is versioned, so an older build reads
it correctly.

**Environment variable rollback** — changing a variable does not affect the running deployment until
it is redeployed. If a bad value is set, correct it and redeploy; the previous deployment keeps
serving in the meantime.

**Database rollback is separate and harder.** Promoting an older deployment does not undo a
migration, and a migration that drops a column cannot be reversed by a deploy at all. Before applying
any destructive migration:

1. Confirm the Supabase backup schedule is active and note the latest backup time.
2. Prefer additive changes — add a column, migrate reads, drop it in a later release.
3. If a rollback is unavoidable, restore from backup and accept the data written since it.

---

## Post-deploy verification

Run against the production URL, in this order.

- [ ] `curl -sI https://peptologics.com` → 200, and every security header present
- [ ] `curl -s https://peptologics.com | grep Retatrutide` → product content is in the raw HTML
- [ ] Home page in a fresh browser profile → the disclaimer gate appears and blocks the page
- [ ] Accept the gate → the page becomes usable; reload → no flash of the gate
- [ ] `/api/health` → `database: reachable`, `channels.email: configured`
- [ ] Catalog lists 12 products with prices matching the client's list
- [ ] A product page returns 200; an invented slug returns a real **404**
- [ ] Submit one real test inquiry → order row created, email received, then delete the test row
- [ ] `/sitemap.xml` lists 12 product URLs; `/robots.txt` disallows cart, inquiry and `/api/`
- [ ] `/cart`, `/inquiry`, `/inquiry/success`, `/not-eligible` all send `noindex`
- [ ] **Lighthouse ≥ 95** on Performance, Accessibility, Best Practices, SEO
- [ ] **Rich Results Test** passes on a product page and on the home page's FAQ
- [ ] Vercel logs clean — no unexpected errors after the first traffic

The last two are the two Phase 7 items that could not be checked locally: Lighthouse needs a Chrome
CLI and Rich Results needs a public URL.

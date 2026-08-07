# Deployment — PeptoLogics

Vercel (Next.js) + Supabase (PostgreSQL) + Resend (email).

> **Status: skeleton.** Completed in Phase 9 with real project identifiers and a tested rollback.

---

## Environments

| Environment | Branch            | Supabase           | Indexed                    |
| ----------- | ----------------- | ------------------ | -------------------------- |
| Development | any local         | shared dev project | n/a                        |
| Preview     | any pushed branch | dev project        | **no** — must be `noindex` |
| Production  | `main`            | production project | yes                        |

Preview deployments must never be indexed and must never use production secrets.

## Pre-deploy gate

All four must pass. A failure blocks the deploy.

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```

## Environment variables

The authoritative contract is `src/lib/env.ts`; `.env.example` documents every variable with the
source it comes from. Required for the app to boot: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Everything else is optional and degrades gracefully.

Secrets live only in Vercel's environment variable store. Never in Git, never in documentation, never
in a screenshot.

## Resend setup

1. Add the sending domain in Resend.
2. Add the SPF and DKIM DNS records it gives you at the registrar. Wait for verification.
3. Set `RESEND_API_KEY`, `INQUIRY_NOTIFICATION_FROM` (an address on the verified domain), and
   `INQUIRY_NOTIFICATION_TO`.

Until this is done, inquiries still save and the email channel records `skipped`. Nothing breaks.

## Notification channels

**Email is the only channel.** WhatsApp was removed at the client's request — see ADR-023. There are
no Meta credentials to obtain, no template to get approved, and nothing in the deploy checklist that
waits on Meta.

If it is ever wanted back, the work is an adapter plus one entry in `NotificationService.dispatch`:
`notification_log` and its repository are already channel-generic, and the table's CHECK constraint
still permits a `whatsapp` channel value.

## Adding a product to the catalog

Inserting a row into `products` is **not** enough to make its page reachable. `/products/[slug]` uses
`dynamicParams = false`, so any slug not present at build time returns a real 404 (ADR-014). After
inserting a product:

1. Insert the row (via a seed edit and re-run, or Supabase Studio).
2. **Trigger a redeploy** so `generateStaticParams` picks up the new slug. A Vercel Deploy Hook called
   from a Supabase Database Webhook on `products` INSERT would automate this.
3. `POST /api/revalidate` refreshes the catalog listing, but does **not** create the new detail page.

Editing an existing product — including its price — needs no redeploy. It propagates within the hour,
or immediately via `POST /api/revalidate`.

## Database migrations

Applied through migrations only. Never edit production schema by hand.

```bash
npx supabase link --project-ref <production-ref>
npx supabase db push
```

Review every migration before pushing. Migrations should be reversible where practical.

## Rollback

1. In Vercel, promote the previous good deployment. This is instant and is the first move for any
   production incident.
2. Investigate the root cause. Do not patch production directly.
3. Fix on a branch, verify, redeploy.

Database rollback is separate and harder — a migration that drops a column cannot be undone by
promoting an older deployment. Review destructive migrations especially carefully, and confirm the
Supabase backup schedule is active before applying one.

## Post-deploy verification

- [ ] Home page loads; the disclaimer gate appears on a fresh profile
- [ ] `curl` the home page — full product content present in the raw HTML
- [ ] `/api/health` reports the database reachable
- [ ] Catalog lists all products with correct prices
- [ ] Submit a real test inquiry: order row created, email received
- [ ] `/sitemap.xml` and `/robots.txt` correct
- [ ] Cart, inquiry and success pages are `noindex`
- [ ] Lighthouse ≥ 95 on all four categories
- [ ] No unexpected errors in Vercel logs

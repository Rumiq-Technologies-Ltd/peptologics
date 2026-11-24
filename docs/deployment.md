# Deployment — PeptoLogics

**Today:** AWS Amplify Hosting (Next.js SSR, `WEB_COMPUTE`) + Supabase (PostgreSQL) + Resend (email).
**Planned:** Amplify in `us-east-1` with a `staging` and a `main` site ([ADR-033](./decisions.md)),
DynamoDB instead of Supabase (ADR-035, written by the DynamoDB workstream) and Amazon SES instead of
Resend (ADR-037, written by the SES workstream).

> **Vercel is no longer used.** Earlier versions of this document described a Vercel setup. Nothing
> here depends on it. ADR-033 records the move.

Domain: **peptologics.com**. DNS is hosted in **Route 53**. Mailboxes are on **Namecheap Private
Email**, so the `MX` records and the root SPF record must never be touched when changing the web or
sending setup (see [DNS](#dns)).

Anything marked `TODO(control-chat)` is an AWS step whose exact console or CLI detail is supplied by
the control chat. Workers do not run AWS commands.

---

## Hosting

| Item          | Today                                                                    | Planned ([ADR-033](./decisions.md))                           |
| ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Service       | AWS Amplify Hosting, `WEB_COMPUTE` (Next.js SSR)                         | unchanged                                                     |
| App           | `peptologics` (id `d1zqn3kd1eopzq`)                                      | a new app with the same name                                  |
| Region        | `eu-north-1`                                                             | `us-east-1`                                                   |
| Branch builds | `main` only                                                              | two branch sites: `staging` and `main`. There is no dev site. |
| Previews      | none (the Vercel previews are gone). Amplify branch deploys replace them | the `staging` site                                            |

Amplify builds a branch when it receives a push. Merging a PR into `main` deploys production.

TODO(control-chat): the exact steps to create the `us-east-1` app, connect it to the repository, set
per-branch variables and cut the domain over.

## Environments

| Environment | Where it runs                      | Database today           | Database planned (ADR-035)                    | `APP_ENV`    | `NEXT_PUBLIC_SITE_URL`     | Indexed |
| ----------- | ---------------------------------- | ------------------------ | --------------------------------------------- | ------------ | -------------------------- | ------- |
| Development | a developer's machine              | the one Supabase project | `peptologics-dev` table                       | unset        | `http://localhost:3000`    | n/a     |
| Staging     | Amplify branch `staging` (planned) | the one Supabase project | `peptologics-staging` table, seeded from prod | `staging`    | the staging site's own URL | **no**  |
| Production  | Amplify branch `main`              | the one Supabase project | `peptologics-prod` table                      | `production` | `https://peptologics.com`  | yes     |

> **One Supabase project serves every environment today.** A developer's laptop writes orders to the
> database production reads. The DynamoDB move (planned, ADR-035) separates them into three tables,
> and the dev table is used only from developers' own machines.

`APP_ENV` is the environment flag (ADR-032). Only `production` opens `robots.txt` and enables the
launch-critical build checks below. `NODE_ENV` cannot be used for this, because a staging build also
runs with `NODE_ENV=production`. Do **not** set `NEXT_PUBLIC_SITE_URL` to the production domain on
the staging site: canonicals and structured data would name the production host from a staging build.

## Pre-deploy gate

All of these must pass. A failure blocks the deploy.

```bash
npm run verify      # typecheck + lint + format + unit tests + build
npm run test:e2e    # Playwright specs against a production build
```

CI (`.github/workflows/ci.yml`) runs on every PR into `staging` and `main`: `npm ci`, `npx next
typegen`, typecheck, lint, format check and tests. It has **no build step yet**, because the build
reads the live database. A build step is to be added after the DynamoDB workstream. The check is
named `ci` and is required by the branch rulesets.

---

## Branches and promotion

Only two long-lived branches exist: `main` (production) and `staging`. **`staging` is the default
branch.** `dev` is retired (tag `archive/dev`). The reasoning is in [ADR-034](./decisions.md).

| Flow      | Branch from                      | PR into   | Merge method                                                                |
| --------- | -------------------------------- | --------- | --------------------------------------------------------------------------- |
| Feature   | `staging` (`feature/*`, `fix/*`) | `staging` | **squash**                                                                  |
| Promotion | `staging`                        | `main`    | **merge commit**, never squash                                              |
| Hotfix    | `main` (`hotfix/*`)              | `main`    | **squash**, then back-merge `main` into `staging` by PR with a merge commit |

- Test locally before opening a PR. Local code runs against the dev data (planned: the
  `peptologics-dev` table).
- A guard in CI fails any PR into `main` whose source is not `staging` or `hotfix/*`.
- `main` and `staging` are protected by rulesets: no deletion, no force-push, PR required, **0 required
  approvals** (the owner is the only approver and GitHub does not let you approve your own PR), check
  `ci` required. `staging-protection` also requires the branch to be up to date with `staging`;
  `main-protection` does not, so a promotion never needs a back-merge first.
- Never commit directly to `main` or `staging`.

**Known issue.** The dead Vercel GitHub App still posts a failing check on every PR. Removing it needs
a GitHub organisation owner: Organisation settings → GitHub Apps → Vercel → Configure → uninstall, or
restrict it to repositories that exclude `peptologics`. It does not block merges.

---

## Environment variables

Today these live in **Amplify environment variables**. The Amplify build spec writes them into
`.env.production` at build time. Set them per branch.

| Variable                        | Value                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `APP_ENV`                       | `production` on `main`, `staging` on `staging`, unset locally                         |
| `SUPABASE_URL`                  | `https://<project-ref>.supabase.co` (retired by ADR-035 once merged)                  |
| `SUPABASE_ANON_KEY`             | Supabase → Settings → API → `anon` key                                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → Settings → API → `service_role`. Secret                                    |
| `NEXT_PUBLIC_SITE_URL`          | `https://peptologics.com` on production only, no trailing slash                       |
| `INQUIRY_EMAIL_PROVIDER`        | `resend` or `ses`. Unset means `resend`. Flip + rebuild to switch/roll back (ADR-037) |
| `INQUIRY_SES_CONFIGURATION_SET` | `peptologics-prod`. Required in production when the provider is `ses`                 |
| `RESEND_API_KEY`                | Resend → API Keys. Secret. Needed only while the provider is `resend`                 |
| `INQUIRY_NOTIFICATION_FROM`     | `PeptoLogics <inquiries@peptologics.com>`: note the space before `<`                  |
| `INQUIRY_NOTIFICATION_TO`       | Where inquiries land. Comma-separated for several recipients                          |
| `NEXT_PUBLIC_CONTACT_EMAIL`     | Public address shown in the footer and on the contact page                            |
| `REVALIDATE_SECRET`             | 24 random bytes hex. Secret                                                           |
| `RATE_LIMIT_SALT`               | 24 random bytes hex. Secret. Changing it resets all rate-limit windows                |

Generate the two secrets:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Two Amplify rules that fail **silently**:

1. **The server runtime only receives variables with an allowed prefix.** The Amplify build spec
   passes a variable to the runtime only if its name starts with `SUPABASE_`, `RESEND_`, `INQUIRY_`,
   `CUSTOMER_`, `NEXT_PUBLIC_`, `REVALIDATE_`, `RATE_LIMIT_` or `APP_ENV`. A new variable with any
   other prefix is set in the console, builds fine, and never reaches the live site. The control chat
   adds the prefix to the build spec. Raise this in the PR that introduces the variable.
2. **Amplify does not allow variable names that start with `AWS_`.** Use another name.

Build-time guardrails in `src/lib/env.ts` fail the build rather than deploy something
half-configured. The first two exist because both failures happened on the live site and neither was
visible from inside the application (ADR-025, amended by ADR-032):

- `NEXT_PUBLIC_SITE_URL` must be a real domain when `APP_ENV=production`, not `localhost` and not
  `*.amplifyapp.com`. Pointed at the deployment URL, every canonical link, Open Graph URL, sitemap
  entry and JSON-LD `@id` names a host that is not the one being served.
- `INQUIRY_NOTIFICATION_FROM` and `INQUIRY_NOTIFICATION_TO` are required when `APP_ENV=production`,
  plus `RESEND_API_KEY` while the provider is `resend` (the default), or
  `INQUIRY_SES_CONFIGURATION_SET` when it is `ses`. Email is the only notification channel, so
  without them an inquiry saves, returns `201`, shows the customer a reference number, and nobody is
  told about the lead.
- `SUPABASE_SERVICE_ROLE_KEY` is required when `NODE_ENV=production`.
- `RATE_LIMIT_SALT` must not be the development default.
- `CUSTOMER_CONFIRMATION_FROM` is optional and falls back to `INQUIRY_NOTIFICATION_FROM`. The customer
  confirmation (ADR-027) goes to an address a stranger typed, so the sending domain must be verified
  with the mail provider or every confirmation records `failed` in the dead-letter list.

> **`NEXT_PUBLIC_SITE_URL` must name the primary host.** The primary host is the apex,
> `https://peptologics.com`: Amplify 301-redirects `https://www.peptologics.com/<*>` to it. The
> redirect is needed because the inquiry origin check once refused every request from the `www` host
> with 403.

**Planned (ADR-033, ADR-035, ADR-037).** DynamoDB and SES will be reached through the Amplify app's
IAM role, with no access keys. Remaining secrets stay in Amplify environment variables.
TODO(control-chat): decide whether the remaining secrets move to SSM Parameter Store.

---

## First-time Amplify setup

Do these in order. The domain only enters at step 5.

1. **Create the app.** Amplify Hosting, platform `WEB_COMPUTE`, connected to
   `Rumiq-Technologies-Ltd/peptologics`. Framework preset Next.js; the repo needs no build overrides.
   TODO(control-chat): exact steps, region `us-east-1`, app tags.
2. **Set the environment variables** from the table above, per branch.
3. **Deploy a branch and check it.** Against the branch URL:

   ```bash
   curl -s https://<branch-url>/api/health | jq
   ```

   Expect `database: "reachable"` and `channels.email: "configured"`.

4. **Promote.** Merge a `staging` → `main` PR. Amplify builds and releases `main`.
5. **Add the domain and the redirects.** Recreate both redirect rules on the new app:
   `https://www.peptologics.com/<*>` → `https://peptologics.com/<*>` (301), plus the existing second
   rule. TODO(control-chat): domain association, certificate and the exact redirect rules.

---

## DNS

DNS for `peptologics.com` is hosted in **Route 53**. Mail is on **Namecheap Private Email**: the `MX`
records point to `privateemail.com`, the root SPF record includes it, and DMARC is `p=none`.

- **Never change or remove the `MX` records or the root SPF `TXT` record.** Doing so stops staff mail.
- Mail-sending setup for the web app uses DKIM `CNAME` records and a custom MAIL FROM subdomain, never
  the root SPF.
- Never `CNAME` the apex. Amplify domain association handles the apex and `www` records.
- Propagation is usually minutes and can be up to 48 hours. Check with:

```bash
nslookup peptologics.com
nslookup www.peptologics.com
```

TODO(control-chat): the exact records Amplify and SES need, and who creates them.

### Sending domain for email

**Today (Resend).** The sender domain must be verified in Resend with its SPF/DKIM records before
inquiry email can reach anyone but the Resend account owner. Production must not ship on the sandbox
sender `onboarding@resend.dev`.

**SES (ADR-037).** Amazon SES in `us-east-1` replaces Resend once `INQUIRY_EMAIL_PROVIDER=ses` is set and proven. Both variables use the `INQUIRY_` prefix, so the Amplify build spec already passes them. The app's IAM role supplies credentials; there are no keys. The sender addresses stay as
they are today. Expected volume is under 10 inquiries a day.

---

## Security headers

Set in [`next.config.ts`](../next.config.ts) so they apply to `next start` and to any host, and so a
change to them goes through review.

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
buys is real: no third-party origin can load anything, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'` and `frame-ancestors 'none'`. Full reasoning is in the config's own comment.

Verify after deploy:

```bash
curl -sI https://peptologics.com | grep -Ei "content-security|strict-transport|x-frame|referrer|permissions"
```

---

## Database migrations

**Today (Supabase).** Applied through migrations only. Never edit production schema by hand.

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
> the existing ones were applied and commit the matching `.sql` file so the repo stays the record of
> truth.

All twelve migrations are applied to project `pmbatptoffscqtnfmhbz`, including
`create_inquiry_email_only` from the WhatsApp removal.

**Planned (ADR-035).** DynamoDB replaces Supabase, so this section is rewritten by the DynamoDB
workstream together with `docs/database.md`.

## Adding a product to the catalog

Inserting a row into `products` is **not** enough to make its page reachable. `/products/[slug]` uses
`dynamicParams = false`, so any slug not present at build time returns a real 404 (ADR-014). After
inserting a product:

1. Insert the row (via a seed edit and re-run, or Supabase Studio).
2. **Trigger a redeploy** so `generateStaticParams` picks up the new slug. TODO(control-chat): an
   Amplify build hook that a database event could call, if automation is wanted.
3. `POST /api/revalidate` refreshes the catalog listing, but does **not** create the new detail page.

Editing an existing product, including its price, needs no redeploy. It propagates within the hour,
or immediately with:

```bash
curl -X POST https://peptologics.com/api/revalidate \
  -H "Authorization: Bearer $REVALIDATE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"slug":"retatrutide-10mg"}'
```

`/`, `/products` and `/lab-testing` are purged too, with or without a slug: a price appears in three
places and a certificate in a fourth, and they must not disagree. Full contract in [api.md](./api.md).

> **A data-only change plus a redeploy is not always enough.** A build can restore `.next/cache`, and
> a prerendered page whose ISR entry is still valid can be reused even though the database behind it
> changed. Seen locally: after publishing eight certificates, a rebuild kept serving the old empty
> list until `.next` was deleted. If a change is invisible after a deploy, call
> `POST /api/revalidate`: it is instant and cheaper than a cache-cleared rebuild.

## Notification channels

**Email is the only channel.** WhatsApp was removed at the client's request (ADR-023). There are no
Meta credentials to obtain and nothing in the deploy checklist that waits on Meta.

If it is ever wanted back, the work is an adapter plus one entry in `NotificationService.dispatch`:
`notification_log` and its repository are already channel-generic, and the table's CHECK constraint
still permits a `whatsapp` channel value.

Watch `notification_log` for the dead-letter list. Anything left `pending` or `failed` is a lead
nobody was told about:

```sql
select order_id, channel, status, attempts, error_message, created_at
  from notification_log
 where status in ('pending', 'failed')
 order by created_at desc;
```

---

## Rollback

**Deployment rollback** is the first move in any production incident. Redeploy the last good build:
Amplify console → app → branch → an earlier successful build → **Redeploy this version**. (The
control chat can do the same with the AWS CLI `amplify start-job --job-type RETRY --job-id <id>`.)

**Code rollback** is a revert PR through the normal flow: revert on a branch, PR, `ci` green, merge.

Never patch production directly. Investigate afterwards, fix on a branch, verify, merge.

Because every route is either static or a stateless function, redeploying an older build is safe:
there is no in-flight session state to lose and no client-side migration to unwind. The cart lives in
the visitor's own `localStorage` and its stored schema is versioned, so an older build reads it
correctly.

**Environment variable rollback.** Changing a variable does not affect the running deployment until
it is redeployed. If a bad value is set, correct it and redeploy.

**Database rollback is separate and harder.** Redeploying an older build does not undo a migration,
and a migration that drops a column cannot be reversed by a deploy at all. Before applying any
destructive migration:

1. Confirm the Supabase backup schedule is active and note the latest backup time.
2. Prefer additive changes: add a column, migrate reads, drop it in a later release.
3. If a rollback is unavoidable, restore from backup and accept the data written since it.

---

## Post-deploy verification

Run against the production URL, in this order.

- [ ] `curl -sI https://peptologics.com` → 200, and every security header present
- [ ] `https://www.peptologics.com/` → 301 to `https://peptologics.com/`
- [ ] `curl -s https://peptologics.com | grep PL3` → product content is in the raw HTML
- [ ] Home page in a fresh browser profile → the disclaimer gate appears and blocks the page
- [ ] Accept the gate → the page becomes usable; reload → no flash of the gate
- [ ] `/api/health` → `database: reachable`, `channels.email: configured`
- [ ] Catalog lists 12 products with prices matching the client's list
- [ ] A product page returns 200; an invented slug returns a real **404**
- [ ] Submit one real test inquiry → order row created, email received, then delete the test row
- [ ] `/sitemap.xml` lists the product URLs; `/robots.txt` allows the site, disallows `/api/`, and names the sitemap
- [ ] `/cart`, `/inquiry`, `/inquiry/success`, `/not-eligible` all send `noindex`
- [ ] **Lighthouse ≥ 95** on Performance, Accessibility, Best Practices, SEO
- [ ] **Rich Results Test** passes on a product page and on the home page's FAQ
- [ ] Amplify and application logs clean, with no unexpected errors after the first traffic

The Lighthouse and Rich Results items need a Chrome CLI and a public URL respectively.

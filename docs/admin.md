# Admin (`/admin`)

The admin is a Shopify-style back office for staff (D35, ADR-038). **Phase 1 is the foundation:**
sign-in, the layout, roles and the audit log. **Phase 2 is Products** (below, ADR-039). Orders, lab
reports and content arrive in later phases (3 to 6), each as its own change.

It exists on **staging and on developer machines only**. It stays off production until Stage 4.

## When it is on

`/admin` is on only when **all** of these hold (`src/lib/admin/enabled.ts`):

| Condition                                                                                                        | Why                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID` and `NEXT_PUBLIC_COGNITO_DOMAIN` are all set | Nothing to sign in to otherwise. None is a secret                                |
| `INQUIRY_DATA_STORE=dynamodb`                                                                                    | The audit log and every later phase live in DynamoDB                             |
| `APP_ENV` is not `production`                                                                                    | Production has no pool or table yet. **Stage 4 removes this line in its own PR** |

Otherwise `/admin`, `/admin/no-access` and `/api/auth/*` answer with the same 404 as any unknown URL.
There is no `ADMIN_ENABLED` variable: Amplify only passes a fixed list of variable prefixes to the
server, and this rule is stricter than a flag.

## Signing in

1. Go to `/admin`. Signed out, you are sent to `/api/auth/sign-in`, then to Cognito's login page.
2. Enter email and password, then the code from your authenticator app (TOTP).
3. Cognito sends you back to `/api/auth/sign-in-callback`, which sets the session and takes you to `/admin`.
4. **Sign out** (top bar) goes to `/api/auth/sign-out`, through Cognito, and back to the public home page.

There is **no sign-up**. `/api/auth/sign-up` is a 404 and no page links to one. Cognito enforces the
password rules, MFA and lockout.

### Callback URLs (registered on the Cognito app client)

| Environment | Sign-in callback                                                          | Sign-out callback                                                          |
| ----------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Staging     | `https://staging.d10n0qgtlyryh5.amplifyapp.com/api/auth/sign-in-callback` | `https://staging.d10n0qgtlyryh5.amplifyapp.com/api/auth/sign-out-callback` |
| Local       | `http://localhost:3000/api/auth/sign-in-callback`                         | `http://localhost:3000/api/auth/sign-out-callback`                         |

The origin is `NEXT_PUBLIC_SITE_URL`, so it must equal the site's real address on each environment
(staging: `https://staging.d10n0qgtlyryh5.amplifyapp.com`). The app client must be public (no secret),
use the authorization-code grant with PKCE, and allow the scopes `openid` and `email`.
`NEXT_PUBLIC_COGNITO_DOMAIN` is the managed-login hostname with no `https://`.

### Sessions

Tokens live in **httpOnly, Secure, `SameSite=Strict` cookies** set by the server. JavaScript on the
page never sees them, and nothing is in localStorage. The short-lived state and PKCE cookies used
during the round trip to Cognito are `SameSite=Lax`, which they must be: a browser does not send a
Strict cookie when Cognito sends the visitor back (ADR-038). Access and ID tokens last 30 minutes;
`src/proxy.ts` refreshes them with the refresh token as you browse.

## Roles

A role is a Cognito **group**, read from the `cognito:groups` claim.

| Group    | Role   | Can                                                 |
| -------- | ------ | --------------------------------------------------- |
| `owner`  | Owner  | Everything, including Settings and staff            |
| `editor` | Editor | Products, content and orders. No Settings, no staff |
| neither  | none   | Signs in, then sees **No access**                   |

A person in both groups is an Owner. The sidebar hides what a role cannot use, but **the server
enforces it**: every page, server action and route calls `requireAdmin({ role })`.

## How staff are added

For now, by the control chat, in Cognito: create the user (admin-only creation), add them to `owner`
or `editor`, and they set their password and authenticator app at first sign-in. There is no staff
screen yet. To remove someone, disable the user in Cognito; their session ends when their access
token next needs refreshing (within 30 minutes).

## For developers: protecting a page, action or route

```ts
// A page or server action: redirects, 404s or throws as needed, returns the session.
const session = await requireAdmin({ role: "editor" });

// A server action or route that changes data: also refuses another site's origin.
const session = await requireAdmin({ role: "owner", mutating: true });

// A route handler that must answer 401/403 itself.
const result = await authorizeAdmin({ role: "editor", mutating: true });
if (!result.ok)
  return Response.json(
    { success: false },
    { status: result.reason === "unauthenticated" ? 401 : 403 },
  );
```

Rules:

- **Every** admin page calls `requireAdmin`. A layout's check does not stop its pages rendering.
- `proxy.ts` only redirects signed-out visitors and refreshes cookies. It is not the security boundary.
- `/admin/**` is dynamic, `no-store`, `noindex`, disallowed in `robots.txt` and not in the sitemap.
- It has its own root layout (`src/app/admin/layout.tsx`), so none of the public site's chrome, disclaimer
  gate or cart loads. The public site lives in the `(site)` route group; URLs are unchanged.
- The CSP on `/admin` is per-request and nonce-based (`src/lib/admin/csp.ts`, set in `src/proxy.ts`).

## Audit log

One DynamoDB item per admin action, in the same table as everything else:

| Item      | PK                | SK                     |
| --------- | ----------------- | ---------------------- |
| Audit log | `AUDIT#<yyyy-mm>` | `<ISO timestamp>#<id>` |

Attributes: `actor_email`, `actor_role` (absent if the person has no role), `action`, `target`,
`request_id`, `timestamp`. **The staff email is the only personal data.** One month is one Query,
oldest first. Phase 1 records `sign_in`, `sign_out` and `access_denied`; Phase 2 adds the product
actions above, with a `changes` attribute (field to before and after) on each change. The app only ever adds items, never edits or deletes them. A failed audit write is logged
and does not block a sign-in. For a product change the audit item is part of the transaction, so a change
cannot happen without its record.

To read the log, query `PK = AUDIT#2026-11` in the DynamoDB console.

## Products (Phase 2)

`/admin/products` (Owner and Editor). Every change is checked on the server with
`requireAdmin({ role: "editor", mutating: true })` and written to the audit log in the same
transaction as the change.

**List.** Image, name, strength, price, status (Active, Out of stock, Archived), featured and display
order. Search by name, filter by status and category, sort. All of it runs over the whole list in the
browser (about thirty products). The list says which products the home page shows: the first three
featured active ones in display order (D32).

**Add and edit** (`/admin/products/new`, `/admin/products/[id]`). One Zod schema is used by the form and
by the server action. The web address is suggested from the name and vial size (`bpc-157-10mg`) and can
be edited. Cost per mg is worked out on save and never typed. The price is typed in dollars and stored as
cents.

**Archive and restore (D37).** There is no hard delete. Archive sets the status to `archived`: the
product leaves the shop, the sitemap and search, and Restore brings it back. **Out of stock also hides a
product from the shop**, as it always has; there is no "sold out" label.

**Two people editing.** Every product has a `version`. A save carries the version it was opened with; if
someone else saved first it is refused with "This product changed since you opened it. Reload."

**Web address changes (D26).** The old address keeps a permanent redirect, stored in DynamoDB as a
_retired slug_ (see [database.md](./database.md)). It points at the product, not at a slug, so a product
renamed twice still lands on its current page in one hop. A retired slug can never be taken by another
product; the product itself may take it back. The older redirects in `next.config.ts` stay there for now
and are served first. **Do not reuse the address of a product that was renamed earlier:** a
`next.config.ts` redirect beats the page, so a live product on that address would be unreachable. Moving
those redirects into this store is a follow-up after Stage 4 (the production data is still on Supabase).

**Going live.** An edit, archive, restore, featured toggle or reorder refreshes the product page,
`/products`, `/`, `/lab-testing` and the sitemap straight away. A **new product page needs a site build**
(`dynamicParams = false`), so creating a product or changing a slug calls the Amplify webhook: "Saved.
The product page goes live in about 5 minutes." At most one build per two minutes; the products list
shows a **Publish now** banner while pages are waiting. If the webhook fails the save still succeeds and
the page goes live after the next deploy. See [deployment.md](./deployment.md).

**Images.** Staff pick a JPEG, PNG or WebP of up to 5 MB, square or nearly square (width over height
between 0.9 and 1.1), 600 to 4000 pixels a side. The browser sends it straight to S3 with a presigned
PUT that is signed for exactly that type and size. The server then reads it, checks it by content, and
re-encodes it as a WebP of at most 1200 pixels, which strips metadata and fixes the format, and stores
it under `products/`. Only `products/*` is served, through CloudFront. Existing `public/products/*` paths
keep working: `image_url` is either a site path or a CloudFront address. Without the two media variables,
upload is off and the form says so.

**Audit actions.** `product_created`, `product_updated` (each changed field as before and after; price in
cents), `product_archived`, `product_restored`, `product_reordered` and `product_image_uploaded`. There
is no customer data in any of them.

**Settings.** `REVALIDATE_REBUILD_HOOK_URL` (server-only secret),
`NEXT_PUBLIC_MEDIA_BUCKET_NAME` and `NEXT_PUBLIC_MEDIA_BASE_URL`. No new variable prefix.

## Limits worth knowing

- Sign-out is a plain GET link, so another site could sign someone out. A nuisance, not a breach.
- Removing a user in Cognito ends their session at the next token refresh, not instantly.
- If Cognito's refresh-token rotation has a grace period, the proxy forwards the refreshed cookies
  into the same request so the refresh token is spent once per request, not twice.

# Admin (`/admin`)

The admin is a Shopify-style back office for staff (D35, ADR-038). **Phase 1 (this) is the
foundation:** sign-in, the layout, roles and the audit log. Products, orders, lab reports and
content arrive in later phases (2 to 6), each as its own change.

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
oldest first. Phase 1 records `sign_in`, `sign_out` and `access_denied`; later phases record every
change. The app only ever adds items, never edits or deletes them. A failed audit write is logged
and does not block the action in Phase 1; later phases that change data should surface it.

To read the log, query `PK = AUDIT#2026-11` in the DynamoDB console.

## Limits worth knowing

- Sign-out is a plain GET link, so another site could sign someone out. A nuisance, not a breach.
- Removing a user in Cognito ends their session at the next token refresh, not instantly.
- If Cognito's refresh-token rotation has a grace period, the proxy forwards the refreshed cookies
  into the same request so the refresh token is spent once per request, not twice.

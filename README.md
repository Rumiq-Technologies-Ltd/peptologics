# PeptoLogics

Lead-generation website for research peptides. Visitors browse the catalog, build an inquiry list, and
submit their details; the company is notified by email and WhatsApp and follows up manually.

**This is not an e-commerce site.** No payments are processed. The collection is an _inquiry list_,
the outcome is a _quotation_.

All products are supplied for laboratory research use only and are not for human or animal consumption.

---

## Stack

| Concern   | Choice                                                       |
| --------- | ------------------------------------------------------------ |
| Framework | Next.js 16.3 (App Router), React 19.2                        |
| Language  | TypeScript, strict                                           |
| Styling   | Tailwind CSS v4 (CSS-first config), shadcn/ui                |
| Forms     | React Hook Form + Zod v4                                     |
| Database  | Supabase PostgreSQL                                          |
| Email     | Resend                                                       |
| WhatsApp  | Meta Cloud API (env-gated; `wa.me` deep link until approved) |
| Hosting   | Vercel                                                       |

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Three variables are required for the app to boot: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Everything else is optional — missing Resend or WhatsApp credentials
degrade the relevant notification channel to `skipped` rather than throwing, so the full inquiry flow
works locally without them.

## Scripts

| Script                  | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `npm run dev`           | Development server                                                |
| `npm run build`         | Production build (Turbopack)                                      |
| `npm run typecheck`     | `tsc --noEmit`                                                    |
| `npm run lint`          | ESLint, including the architectural boundary rules                |
| `npm run format`        | Prettier, with Tailwind class sorting                             |
| `npm run verify`        | typecheck + lint + format check + build. Run before every commit. |
| `npm run db:types`      | Regenerate `src/types/database.types.ts` from the linked project  |
| `npm run db:new <name>` | Create a migration                                                |
| `npm run db:reset`      | Reset the local database and re-run migrations + seed             |

## Architecture in one paragraph

Strict layering: UI → hooks → services (business rules) → repositories (database access) → Supabase.
The UI never touches the database, and this is enforced by tooling rather than convention —
`import "server-only"` on every server module plus ESLint `no-restricted-imports` zones on the
presentation folders. Repositories throw typed errors; services return a `ServiceResult`; Route
Handlers map that onto a consistent JSON envelope. Every error carries a customer-safe `publicMessage`
separately from its technical detail, so a Postgres error can never reach a browser.

## Documentation

| File                                                     | Contents                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| [`CLAUDE.md`](./CLAUDE.md)                               | Engineering standards. Takes precedence over everything below.        |
| [`docs/instructions.md`](./docs/instructions.md)         | The client brief, locked decisions, and how to work through the build |
| [`docs/tasks.md`](./docs/tasks.md)                       | Phase-by-phase task checklist                                         |
| [`docs/architecture.md`](./docs/architecture.md)         | Layers, rendering strategy, data flows, version-specific gotchas      |
| [`docs/brand-guidelines.md`](./docs/brand-guidelines.md) | Colour, type, logo usage, visual concept, voice                       |
| [`docs/database.md`](./docs/database.md)                 | Schema, relationships, RLS posture, migration workflow                |
| [`docs/api.md`](./docs/api.md)                           | Endpoints, response envelope, status codes                            |
| [`docs/deployment.md`](./docs/deployment.md)             | Environments, third-party setup, rollback                             |
| [`docs/decisions.md`](./docs/decisions.md)               | ADR log and the list of open questions for the client                 |

## Notes for contributors

This is Next.js **16**, and several conventions differ from older App Router code: `params` and
`searchParams` are Promises, `error.tsx` receives `retry` rather than `reset`, middleware is
`proxy.ts`, and Turbopack is the default for `next build` — a `webpack` key in `next.config.ts` will
fail the build. Zod is **v4** (`z.email()`, `error:`, `.issues`). Tailwind is **v4** with no
`tailwind.config.ts`. Read `node_modules/next/dist/docs/` before assuming an API.

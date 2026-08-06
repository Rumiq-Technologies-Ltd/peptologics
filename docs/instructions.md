# Working Instructions — PeptoLogics

> This file is the standing brief for anyone (human or AI) working on this repository.
> Read it together with `CLAUDE.md`, which takes precedence on all engineering standards.
> Task checklist lives in [tasks.md](./tasks.md). Decision log lives in [decisions.md](./decisions.md).

---

## 1. The brief, as given by the client

Build a lead-generation website named **PeptoLogics** (`peptologics.com`) for research peptides.

Reference material supplied in `public/assets/`:

| File                                                                                | What it is                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `peptologics logo.jpeg`                                                             | Circular badge lockup — molecular lattice glyph + wordmark         |
| `pepto logics logo 1.jpeg`                                                          | Horizontal lockup + tagline "Premium Peptides · Pure Results"      |
| `product list.jpeg`                                                                 | Marketing poster listing 12 products with size, price, cost per mg |
| `inspiration design.jpeg`                                                           | Screenshot of atlabsourcing.org — the ordering flow to borrow      |
| `disclaimer1.jpeg`, `disclaimer 2.jpeg`, `disclaimer 3.jpeg`, `disclaimer 3.1.jpeg` | Four competitor Research-Use-Only gate designs, for reference only |

Layout inspiration: <https://atlabsourcing.org/>

The client's instructions, verbatim in substance:

- Take inspiration from atlabsourcing.org, **but the site must look clearly different and unique.**
- The look should be **pharmacy professional**.
- Derive brand guidelines from the logo, and keep the UI **consistent across every page**.
- On first visit, show a **disclaimer pop-up**: research purposes only. The visitor must agree
  before the site appears.
- Then: **hero section**, then a **product section** where a visitor can easily add and remove
  products, with the selection and prices shown in a **cart**.
- On submitting the order, the visitor enters **name, email, phone number and address**.
- That submission is sent to the company by **WhatsApp** and by **email**.
- The company then **reaches out to customers manually**. There is no online payment.
- Use the existing empty Next.js project.
- Read the disclaimer reference images and produce a **unique** gate for PeptoLogics.

## 2. Non-negotiables

1. **`CLAUDE.md` wins.** Layered architecture, Supabase, Zod, TypeScript strict, the Definition of
   Done. Where reality forces a deviation, record it in `decisions.md` and say so out loud — never
   deviate silently.
2. **This is not an e-commerce site.** No payments, no checkout, no "Buy". The collection is an
   **inquiry list**, the outcome is a **quotation**. Copy must never imply a completed sale.
3. **No health, therapeutic, dosing or efficacy claims anywhere.** Every product reference stays
   research-use-only. Claims about testing, purity or logistics must be substantiable by the client.
4. **Do not invent business rules or legal copy.** Placeholders are marked `PLACEHOLDER` in code and
   listed as open questions in `decisions.md`. Legal text is marked `TODO: counsel review`.
5. **The site must stay crawlable** despite the gate. Page content is always in the server-rendered
   HTML; the gate is an overlay on top of it. Never `display: none`, never a redirect, never
   user-agent sniffing.
6. **The server is the price authority.** No wire payload from the browser carries a price. Ever.

## 3. Locked decisions

| #   | Decision                                                                                                              | Source                    |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Supabase project `pmbatptoffscqtnfmhbz`. Products live in Postgres, never hardcoded.                                  | Client                    |
| 2   | Inquiry form: name, email, phone, street address, city, state, ZIP **required**; apt/suite and notes **optional**.    | Client                    |
| 3   | No shipping fee, no order minimum. Cart shows an **estimated** subtotal; the representative confirms the final total. | Client                    |
| 4   | Brand blue `#1A3E9C` (from the logo) is primary; `#1D4ED8` is the interactive accent.                                 | Client                    |
| 5   | WhatsApp ships as a `wa.me` deep link plus an env-gated null adapter. The Meta Cloud API adapter lands later.         | Engineering — see ADR-007 |
| 6   | Single light theme. No dark mode.                                                                                     | Engineering               |
| 7   | Money as integer cents throughout.                                                                                    | Engineering — ADR-002     |
| 8   | `cacheComponents` stays off until after launch.                                                                       | Engineering — ADR-008     |

## 4. How to work through this

- One task at a time, in the order given in [tasks.md](./tasks.md). Tick it off there when done.
- Each phase ends **green** on `npm run typecheck && npm run lint && npm run build` and is
  independently committable.
- Branch from `dev` using the branch name given in the phase heading. `main` is protected.
- Conventional commits. One logical change per commit.
- Update the relevant file in `docs/` in the same commit as the code it describes.
- When a task is blocked on the client, do everything else in the phase, state plainly what is
  missing, and move on. Do not stall the whole phase on one credential.

## 5. Things that will bite you

- **Next.js 16.3.0 is not the Next.js in your training data.** `params`/`searchParams` are Promises.
  `error.tsx` receives `retry`, not `reset`. Middleware is `proxy.ts`. `next/image` `priority` is
  deprecated in favour of `preload`. Turbopack is the default for build — a `webpack` key in
  `next.config.ts` fails the build. Read `node_modules/next/dist/docs/` before assuming.
- **Zod v4, not v3.** `z.email()` not `z.string().email()`. `error:` not `message:`. `.issues` not
  `.errors`.
- **Tailwind v4.** CSS-first config in `globals.css` via `@theme`. There is no `tailwind.config.ts`.
- **PostgREST returns `numeric` as a string.** That is why money is integer cents, and why
  `cost_per_mg` is coerced exactly once, at the mapper boundary, for display only.
- **The Supabase JS client cannot run multi-statement transactions.** Order + items atomicity comes
  from the `create_inquiry` Postgres function, not from application code.
- **The product poster is not an authoritative source.** Its small print is garbled
  (`PREGISION YOU CAN FAUST`) and BPC-157's cost-per-mg is missing its `$`. Confirm prices with the
  client before trusting them.

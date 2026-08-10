# Testing — PeptoLogics

Two suites, run separately because they cost different amounts of time.

```bash
npm run test           # Vitest, ~3s
npm run test:watch     # Vitest in watch mode
npm run test:coverage  # Vitest with a v8 coverage report
npm run test:e2e       # Playwright against a production build, ~1min including the build
npm run test:e2e:ui    # Playwright's UI mode, for debugging a spec
```

`npm run verify` runs typecheck, lint, format, **unit tests** and build. Playwright is
deliberately not in it: `verify` is run constantly and should stay quick.

---

## What is tested, and why that

The pyramid, weighted the way CLAUDE.md asks — fast tests for the rules, a handful of
slow ones for the journeys nobody would notice breaking.

| Suite                          | Covers                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `cart.calculations.test.ts`    | Quantity bounds, untrusted `localStorage` parsing, the archived-product drop, subtotals |
| `inquiry.schema.test.ts`       | Field rules, sanitisation, and the price-authority guarantee                            |
| `inquiry.service.test.ts`      | Price authority, spam suppression, rate limiting, replay, notification isolation        |
| `notification.service.test.ts` | That dispatch cannot throw, and every outcome reaches the log                           |
| `rate-limit.service.test.ts`   | Bucket keys, blocking, and the fail-open behaviour                                      |
| `product.service.test.ts`      | Sort narrowing, search sanitisation, the featured fallback                              |
| `resilience.test.ts`           | Retryable-vs-final classification, and real abort on timeout                            |
| `format.test.ts`               | Money and strength formatting, slug validation                                          |
| `QuantityStepper.test.tsx`     | The control as a user and a screen reader meet it                                       |
| `e2e/gate.spec.ts`             | The RUO gate: blocking, no Escape, keyboard-only, persistence, exempt policy pages      |
| `e2e/inquiry-journey.spec.ts`  | Browse → add → cart → form → success, payload shape, double-submit, honeypot            |
| `e2e/coa-library.spec.ts`      | Certificate rows, the dialog, focus restoration, and that each scan actually resolves   |
| `e2e/hero-3d.spec.ts`          | WebGL context, canvas sizing and dpr cap, pixels drawn, CLS, reduced-motion stillness   |

Coverage on the code these suites are meant to cover sits at ~97% of statements. That
number is a by-product, not the goal — the goal is that every rule which decides what a
customer is quoted has a test that fails when it changes.

## Deliberate exclusions

**Repositories are not unit-tested.** Each one is a shaped Supabase call containing no
decisions, so a test would assert that a mocked query builder was called the way the
mock was written. Their real behaviour — RLS, grants, the atomic RPC, the idempotency
constraint — can only be verified against a real database, and was, during Phases 1, 2
and 5.

**The E2E suite intercepts `POST /api/inquiries`** (ADR-024). Letting it through would
write rows to the client's Supabase and send a real email on every run. What the
interception cannot fake is the part only a browser proves: that the form assembles the
right request — correct items and quantities, an `Idempotency-Key` header, and no price
field anywhere in the body.

**Playwright runs two workers, not the default.** The hero specs each hold a live WebGL context at
60fps; at full parallelism they starved unrelated specs and the inquiry submit intermittently never
navigated. Every such failure was contention between tests rather than a defect — each spec passes
consistently alone. Capping workers bounds the problem where a blanket `retries` would have hidden it
(ADR-026).

**Playwright runs against `next build && next start`, not `next dev`.** The gate depends
on a pre-paint script and on hydration behaviour that differs between the two, and
ADR-017 documents a bug that appeared only in a production build.

## Conventions

- Dependencies are injected, so services are tested against small fakes rather than
  module mocks. That is what the composition root is for.
- Component tests query by role and accessible name. A test that fails when the control
  becomes unusable to a screen reader is worth more than one that fails when a class
  name changes.
- `src/test/factories.ts` builds test data with sensible defaults and an override bag, so
  each test states only the field it cares about.
- `server-only` is aliased to an empty stub in `vitest.config.mts`. The real module throws
  on import by design; the guard stays fully active in the build, and only the test run
  sees the stub.

## Bugs these tests found

Written down because it is the honest measure of whether the suite was worth writing.

1. `sanitizePhone` left a trailing space when it stripped letters — `"+1 555 0102030 ext"`
   was stored as `"+1 555 0102030 "`. Fixed by sanitising again after filtering.
2. `clampQuantity(Infinity)` returns the minimum, not the maximum. Correct, but not what
   the first test assumed; the behaviour is now pinned so it cannot drift.

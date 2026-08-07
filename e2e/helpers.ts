import type { Page, Request } from "@playwright/test";

/**
 * Shared plumbing for the end-to-end specs.
 */

/** Matches the storage contract in `src/features/disclaimer/acknowledgement.ts`. */
const RUO_STORAGE_KEY = "pl_ruo_ack";
const RUO_STORAGE_VERSION = 1;

/**
 * Pre-accepts the Research-Use-Only gate for tests that are not about the gate.
 *
 * Written before the first navigation via `addInitScript`, so the pre-paint script sees
 * it and the overlay never mounts. The alternative — clicking through four checkboxes
 * and a countdown in every spec — would make each test slower and make a gate change
 * break every unrelated spec at once.
 *
 * The gate's own behaviour is covered properly in `gate.spec.ts`, which does not call
 * this.
 */
export async function preAcceptGate(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, version]) => {
      window.localStorage.setItem(
        key as string,
        JSON.stringify({ v: version as number, at: Date.now() }),
      );
    },
    [RUO_STORAGE_KEY, RUO_STORAGE_VERSION],
  );
}

/**
 * Empties the persisted inquiry list once, so a spec starts from a known state.
 *
 * The sentinel is essential. `addInitScript` runs before **every** navigation, so an
 * unconditional `removeItem` would wipe the list again on the way to `/cart` and
 * `/inquiry` — the product added a moment earlier would vanish and the submit button
 * would sit permanently disabled. Diagnosed exactly that way on the first run.
 *
 * `sessionStorage` is per browser context, and Playwright gives each test a fresh one,
 * so this clears once per test and never again within it.
 */
export async function clearInquiryList(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const SENTINEL = "e2e-inquiry-list-cleared";

    if (!window.sessionStorage.getItem(SENTINEL)) {
      window.localStorage.removeItem("pl_inquiry_list");
      window.sessionStorage.setItem(SENTINEL, "1");
    }
  });
}

export interface CapturedSubmission {
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/**
 * Intercepts `POST /api/inquiries`, records what was sent, and answers 201.
 *
 * Deliberate: the endpoint's real behaviour is covered by unit tests against the
 * service and was verified against the live database during Phase 5. Letting the E2E
 * suite hit it for real would write rows to the client's Supabase and send an actual
 * email to their inbox on every run.
 *
 * What this still proves is the part only a browser can: that the form assembles the
 * correct request — the right items, the idempotency header, and **no prices**.
 */
export async function interceptInquirySubmit(
  page: Page,
  options: { orderNumber?: string; status?: number; body?: unknown } = {},
): Promise<CapturedSubmission[]> {
  const captured: CapturedSubmission[] = [];

  await page.route("**/api/inquiries", async (route, request: Request) => {
    captured.push({
      headers: request.headers(),
      body: JSON.parse(request.postData() ?? "{}") as Record<string, unknown>,
    });

    await route.fulfill({
      status: options.status ?? 201,
      contentType: "application/json",
      body: JSON.stringify(
        options.body ?? {
          success: true,
          message: "Your inquiry has been received.",
          data: { orderNumber: options.orderNumber ?? "PL-009001", created: true },
        },
      ),
    });
  });

  return captured;
}

/** Fills every required field on the inquiry form with valid values. */
export async function fillInquiryForm(page: Page): Promise<void> {
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Phone").fill("+1 555 010 2030");
  await page.getByLabel("Street address").fill("12 Analytical Engine Way");
  await page.getByLabel("City").fill("Cambridge");
  await page.getByLabel("State").fill("MA");
  await page.getByLabel("ZIP code").fill("02139");
}

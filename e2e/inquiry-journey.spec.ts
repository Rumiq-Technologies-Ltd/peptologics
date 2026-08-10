import { expect, test } from "@playwright/test";

import {
  clearInquiryList,
  fillInquiryForm,
  interceptInquirySubmit,
  preAcceptGate,
} from "./helpers";

/**
 * The journey the whole site exists for: browse → add → review → submit → confirmed.
 *
 * The submit call is intercepted (see `interceptInquirySubmit`), so these runs write
 * nothing to the database and send no email. What the interception cannot fake is the
 * part worth testing here — that a real browser, driving the real form, assembles the
 * correct request.
 */

test.beforeEach(async ({ page }) => {
  await preAcceptGate(page);
  await clearInquiryList(page);
});

test("a visitor can build an inquiry list and submit it", async ({ page }) => {
  const submissions = await interceptInquirySubmit(page, { orderNumber: "PL-009042" });

  await page.goto("/products");

  // Add two different compounds from the catalog.
  const firstRow = page.locator("main li").first();
  const firstName = await firstRow.locator("a").first().innerText();
  await firstRow.getByRole("button", { name: /^Add / }).click();

  const secondRow = page.locator("main li").nth(1);
  await secondRow.getByRole("button", { name: /^Add / }).click();

  // The header badge is the running count, in vials.
  await expect(page.getByRole("link", { name: /Inquiry list, 2 vials/ })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1, name: "Your inquiry list" })).toBeVisible();
  await expect(page.getByText("2 compounds selected")).toBeVisible();
  await expect(page.getByRole("link", { name: firstName }).first()).toBeVisible();

  await page.getByRole("link", { name: "Request a quotation" }).click();
  await expect(page).toHaveURL(/\/inquiry$/);

  await fillInquiryForm(page);

  /*
   * Wait for the button to be enabled before clicking it.
   *
   * It is disabled until the persisted list has rehydrated from localStorage, and
   * Playwright's actionability check can be satisfied by the enabled state a moment
   * before React re-disables it mid-hydration — the click then lands on nothing and the
   * page simply stays put. This was intermittent until the suite got busy enough to
   * widen the window, which is the usual way a race announces itself.
   */
  const send = page.getByRole("button", { name: /^Send inquiry/ });
  await expect(send).toBeEnabled();
  await send.click();

  await expect(page).toHaveURL(/\/inquiry\/success\?ref=PL-009042/, { timeout: 15_000 });
  await expect(page.getByText("PL-009042")).toBeVisible();

  // The list is cleared on success, so the back button cannot land on a cart the
  // visitor has already submitted.
  await expect(page.getByRole("link", { name: "Inquiry list, empty" })).toBeVisible();

  expect(submissions).toHaveLength(1);
});

test("the submitted payload carries quantities and no prices", async ({ page }) => {
  const submissions = await interceptInquirySubmit(page);

  await page.goto("/products");
  await page.locator("main li").first().getByRole("button", { name: /^Add / }).click();
  // Bump to two, so a quantity that is not the default reaches the wire.
  await page
    .locator("main li")
    .first()
    .getByRole("button", { name: /^Increase/ })
    .click();

  await page.goto("/inquiry");
  await fillInquiryForm(page);

  const send = page.getByRole("button", { name: /^Send inquiry/ });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page).toHaveURL(/\/inquiry\/success/, { timeout: 15_000 });

  const [submission] = submissions;
  expect(submission).toBeDefined();

  // The idempotency key is what makes a retry safe.
  expect(submission?.headers["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

  const items = submission?.body.items as { productId: string; quantity: number }[];
  expect(items).toHaveLength(1);
  expect(items[0]?.quantity).toBe(2);
  // Exactly two keys per item: there is no field in which to send a price (ADR-005).
  expect(Object.keys(items[0] ?? {}).sort()).toEqual(["productId", "quantity"]);

  const serialised = JSON.stringify(submission?.body);
  expect(serialised).not.toMatch(/price/i);
  expect(serialised).not.toMatch(/subtotal/i);

  // The dwell stamp and the acknowledgement travel with it.
  expect(typeof submission?.body.formStartedAt).toBe("number");
  expect(submission?.body.ruoAcknowledgedAt).toBeTruthy();
});

test("double-clicking send produces one request, not two", async ({ page }) => {
  const submissions = await interceptInquirySubmit(page);

  await page.goto("/products");
  await page.locator("main li").first().getByRole("button", { name: /^Add / }).click();

  await page.goto("/inquiry");
  await fillInquiryForm(page);

  const send = page.getByRole("button", { name: /^Send inquiry/ });
  await expect(send).toBeEnabled();
  await send.click();
  // The button disables itself while submitting, so the second click lands on nothing.
  await send.click({ force: true, timeout: 2000 }).catch(() => undefined);

  await expect(page).toHaveURL(/\/inquiry\/success/, { timeout: 15_000 });
  expect(submissions).toHaveLength(1);
});

test("the honeypot is present, empty, and unreachable by keyboard", async ({ page }) => {
  await page.goto("/inquiry");

  const honeypot = page.locator("#company-website");
  await expect(honeypot).toHaveCount(1);
  await expect(honeypot).toHaveValue("");
  await expect(honeypot).toHaveAttribute("tabindex", "-1");

  // Hidden from assistive technology, but still in the DOM for anything that fills
  // every input it finds.
  await expect(page.locator("[aria-hidden='true']").filter({ has: honeypot })).toHaveCount(1);

  // Tabbing from the first real field must never reach it.
  await page.getByLabel("Full name").focus();
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? "");
    expect(focusedId).not.toBe("company-website");
  }
});

test("the form refuses an empty submission and says which fields need attention", async ({
  page,
}) => {
  const submissions = await interceptInquirySubmit(page);

  await page.goto("/products");
  await page.locator("main li").first().getByRole("button", { name: /^Add / }).click();
  await page.goto("/inquiry");

  await page.getByRole("button", { name: /^Send inquiry/ }).click();

  // Scoped to the form: Next's own route announcer is also `role="alert"`.
  const summary = page.locator("form").getByRole("alert");
  await expect(summary).toContainText("Please check the highlighted fields");
  await expect(summary).toContainText("fields need your attention");
  await expect(page.getByText("Enter your full name.")).toBeVisible();

  // Nothing left the browser.
  expect(submissions).toHaveLength(0);
});

test("an empty inquiry list disables submission and points back to the catalog", async ({
  page,
}) => {
  await page.goto("/inquiry");

  await expect(page.getByRole("button", { name: /^Send inquiry/ })).toBeDisabled();
  // Scoped to the form: the summary panel offers the same link in its own empty state,
  // and both are present once it has hydrated.
  await expect(
    page.locator("form").getByRole("link", { name: "Browse the catalog" }),
  ).toBeVisible();
});

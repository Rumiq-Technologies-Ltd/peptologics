import { expect, test } from "@playwright/test";

import { preAcceptGate } from "./helpers";

/**
 * The published Certificate of Analysis library on the lab-testing page.
 *
 * The list is built from `products.coa_url`, so these assertions are about behaviour
 * rather than a fixed set: whatever has a certificate gets a row, and the dialog shows
 * that product's scan.
 */

test.beforeEach(async ({ page }) => {
  await preAcceptGate(page);
  await page.goto("/lab-testing");
});

test("lists a row per documented compound and opens its certificate in a dialog", async ({
  page,
}) => {
  const buttons = page.getByRole("button", { name: /^View COA/ });
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);

  // Each button names its product for a screen reader, so no two announce identically.
  const first = buttons.first();
  const accessibleName = (await first.getAttribute("aria-label")) ?? (await first.innerText());
  expect(accessibleName).toMatch(/View COA/);

  await first.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: /Certificate of Analysis/ })).toBeVisible();

  // The scan itself, and the escape hatch for zooming or printing it.
  const scan = dialog.getByRole("img", { name: /Certificate of Analysis for / });
  await expect(scan).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Open full size" })).toHaveAttribute(
    "href",
    /^\/coa\/.+\.jpg$/,
  );
});

test("the certificate image actually resolves, rather than 404ing behind the dialog", async ({
  page,
  request,
}) => {
  await page
    .getByRole("button", { name: /^View COA/ })
    .first()
    .click();

  const href = await page.getByRole("link", { name: "Open full size" }).getAttribute("href");
  expect(href).toBeTruthy();

  const response = await request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image");
});

test("closes on Escape and on the close button, and returns focus to the trigger", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: /^View COA/ }).first();

  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Unlike the compliance gate, a document viewer *should* be dismissable.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  // Scoped to the dialog: the page's own chrome has buttons too, and an unscoped
  // "Close" can resolve to one that is not actionable.
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("shows a different certificate when a different row is opened", async ({ page }) => {
  const buttons = page.getByRole("button", { name: /^View COA/ });

  await buttons.nth(0).click();
  const firstTitle = await page.getByRole("dialog").getByRole("heading").innerText();
  await page.keyboard.press("Escape");

  await buttons.nth(1).click();
  const secondTitle = await page.getByRole("dialog").getByRole("heading").innerText();

  expect(secondTitle).not.toBe(firstTitle);
});

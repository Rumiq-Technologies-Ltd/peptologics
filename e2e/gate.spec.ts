import { expect, test } from "@playwright/test";

/**
 * The Research-Use-Only gate.
 *
 * Two properties are load-bearing and pull in opposite directions, which is why they
 * are tested together:
 *
 * 1. A visitor cannot reach or interact with the site until they accept.
 * 2. The content is nonetheless fully present in the server-rendered HTML, because the
 *    site must stay indexable (ADR-009).
 *
 * These specs deliberately do **not** pre-accept the gate.
 */

test("blocks the page behind it while leaving the content crawlable", async ({ page }) => {
  const response = await page.goto("/products");

  // The catalog is in the HTML the server sent, gate or no gate.
  const html = (await response?.text()) ?? "";
  expect(html).toContain("Retatrutide");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // #site-root is marked inert, which removes the whole page from the tab order, the
  // accessibility tree and pointer events in one attribute.
  await expect(page.locator("#site-root")).toHaveAttribute("inert", "");
});

test("cannot be dismissed with Escape", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // A compliance gate is not a dialog the visitor may wave away.
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#site-root")).toHaveAttribute("inert", "");
});

test("can be completed with the keyboard alone, and then releases the page", async ({ page }) => {
  await page.goto("/");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const checkboxes = dialog.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(4);

  // Tab to each affirmation and toggle it with Space — no pointer used anywhere.
  for (let index = 0; index < 4; index += 1) {
    await checkboxes.nth(index).focus();
    await page.keyboard.press("Space");
    await expect(checkboxes.nth(index)).toBeChecked();
  }

  const confirm = dialog.getByRole("button", { name: /Confirm/ });
  await confirm.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("#site-root")).not.toHaveAttribute("inert", "");

  // The page underneath is now genuinely usable.
  await page.getByRole("link", { name: "Products" }).first().click();
  await expect(page).toHaveURL(/\/products$/);
});

test("stays accepted across a reload, with no flash of the gate", async ({ page }) => {
  await page.goto("/");

  const dialog = page.getByRole("dialog");
  const checkboxes = dialog.getByRole("checkbox");
  for (let index = 0; index < 4; index += 1) {
    await checkboxes.nth(index).check();
  }
  await dialog.getByRole("button", { name: /Confirm/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.reload();

  // The pre-paint script sets data-ruo="ok" before the browser composites anything, so
  // a returning visitor never sees the overlay they already dismissed.
  await expect(page.locator("html")).toHaveAttribute("data-ruo", "ok");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the policy pages are exempt, so the terms being accepted can actually be read", async ({
  page,
}) => {
  // If these were gated, the link inside the gate would open a second gate and the
  // visitor could never read what they are agreeing to.
  for (const path of ["/terms", "/privacy", "/research-use-only"]) {
    await page.goto(path);
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("#site-root")).not.toHaveAttribute("inert", "");
  }
});

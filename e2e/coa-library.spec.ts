import { expect, test } from "@playwright/test";

import { preAcceptGate } from "./helpers";

/**
 * The published Certificate of Analysis library on the lab-testing page.
 *
 * The list is the catalog filtered by `COA_ENTRIES`, so the first group of assertions
 * is about behaviour rather than a fixed set.
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
  // The scans are a mix of formats (the seed refreshed several to .webp), so the assertion
  // is that the link points into the certificate folder, not at one extension.
  await expect(dialog.getByRole("link", { name: /Open full size/ })).toHaveAttribute(
    "href",
    /^\/coa\/.+\.(jpe?g|png|webp)$/,
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

  const href = await page.getByRole("link", { name: /Open full size/ }).getAttribute("href");
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

/**
 * The three kinds of COA: a hosted image scan, a hosted Axiom PDF, and a link-only report.
 * These pick rows by name, and skip if the catalog in use does not hold the row.
 */
async function openCertificate(page: import("@playwright/test").Page, name: RegExp) {
  const row = page.getByRole("button", { name });
  test.skip((await row.count()) === 0, "This catalog has no such certificate row.");

  await row.click();
  return page.getByRole("dialog");
}

test.describe("Verify with lab", () => {
  test("sits top right of the header, beside the close button, and stays on screen without scrolling", async ({
    page,
  }) => {
    const dialog = await openCertificate(page, /^View COA for BPC-157 10 mg/);

    const button = dialog.getByRole("link", { name: /Verify with lab/ });
    const [dialogBox, buttonBox, closeBox] = await Promise.all([
      dialog.boundingBox(),
      button.boundingBox(),
      dialog.getByRole("button", { name: "Close" }).boundingBox(),
    ]);

    // Right half of the dialog, inside its header, and clear of the close X.
    expect(buttonBox!.x).toBeGreaterThan(dialogBox!.x + dialogBox!.width / 2);
    expect(buttonBox!.y).toBeLessThan(dialogBox!.y + 130);
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(closeBox!.x);
  });

  test("an image scan shows lab, code, Copy code and a link to the lab's search page", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const dialog = await openCertificate(page, /^View COA for BPC-157 10 mg/);

    await expect(dialog.getByRole("heading", { name: "Bioviridian" })).toBeVisible();
    await expect(dialog.locator("code")).toHaveText("COA9405");

    const verify = dialog.getByRole("link", { name: /Verify with lab/ });
    await expect(verify).toHaveAttribute("href", "https://bioviridians.com/coa-search.html");
    await expect(verify).toHaveAttribute("target", "_blank");
    await expect(verify).toHaveAttribute("rel", /noopener/);

    await dialog.getByRole("button", { name: "Copy code" }).click();
    await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("COA9405");
  });

  test("an Axiom PDF shows lot and purity, Open PDF, and the exact report link", async ({
    page,
  }) => {
    const dialog = await openCertificate(page, /^View COA for MOTS-c 10 mg/);

    await expect(dialog.getByText("MOTSC10-260101-010")).toBeVisible();
    await expect(dialog.getByText("99.51%")).toBeVisible();
    // A PDF is not drawn as an image.
    await expect(dialog.getByRole("img", { name: /Certificate of Analysis for / })).toHaveCount(0);

    const pdf = dialog.getByRole("link", { name: /Open PDF/ });
    await expect(pdf).toHaveAttribute("href", "/coa/AX-2026-1759-FVQU.pdf");
    await expect(pdf).toHaveAttribute("target", "_blank");
    await expect(pdf).toHaveAttribute("rel", /noopener/);

    await expect(dialog.getByRole("link", { name: /Verify with lab/ })).toHaveAttribute(
      "href",
      "https://axiomanalyticslab.com/verify?coa=AX-2026-1759-FVQU",
    );
    // MOTS-c 10 mg has no second lab's report, so no Previous certificate.
    await expect(dialog.getByRole("button", { name: /Previous certificate/ })).toHaveCount(0);
  });

  test("Tesamorelin 20 mg offers its previous 10 mg lot and can return", async ({ page }) => {
    const dialog = await openCertificate(page, /^View COA for Tesamorelin 20 mg/);

    await dialog.getByRole("button", { name: "Previous certificate · 10 mg lot" }).click();
    await expect(
      dialog.getByRole("heading", { name: /Previous certificate/ }).first(),
    ).toBeVisible();
    await expect(dialog.getByText("Tesa10-260101-054")).toBeVisible();
    await expect(dialog.locator("code")).toHaveText("COA9403");

    await dialog.getByRole("button", { name: "Back to current certificate" }).click();
    await expect(dialog.getByText("TSM-260101-010")).toBeVisible();
  });

  test("a link-only PL3 30 mg lists both labs, shows no scan, and has no Previous certificate", async ({
    page,
  }) => {
    const dialog = await openCertificate(page, /^View COA for PL3 30 mg/);

    await expect(dialog.getByRole("heading", { name: "Axiom Analytics Labs LLC" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Bioviridian" })).toBeVisible();
    await expect(dialog.locator("code")).toHaveText(["AX-2026-4286-S5HS", "COA9401"]);
    await expect(dialog.getByRole("img")).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: /Open (PDF|full size)/ })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /Previous certificate/ })).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: /Verify with lab/ })).toHaveCount(2);
  });

  test("an other-company report has no Verify with lab button", async ({ page }) => {
    const dialog = await openCertificate(page, /^View COA for PL-31SS/);

    await expect(dialog.getByRole("heading", { name: /Certificate of Analysis/ })).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Verify with lab/ })).toHaveCount(0);
  });
});

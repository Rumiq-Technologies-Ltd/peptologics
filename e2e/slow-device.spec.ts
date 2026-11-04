import { devices, expect, test, type Page } from "@playwright/test";

import { clearInquiryList, preAcceptGate } from "./helpers";

/**
 * The site on a slow phone over a slow network.
 *
 * Every other spec runs on a fast desktop, which is the one place a speed problem never
 * shows. These run on a mid-range phone profile with Chrome DevTools' own throttling:
 * the CPU slowed 4x and the network shaped to "Slow 4G". Chromium only — the throttling
 * goes through the DevTools protocol, which is all the config runs anyway.
 *
 * The LCP budget is Google's "poor" line (4 s), not its "good" one (2.5 s). These run
 * against a local server alongside other specs on a shared machine, so the tight
 * target would be noise. What this catches is a real regression — a heavy script or an
 * unoptimised image on the critical path — which blows straight through 4 s under this
 * throttling. Real-visitor numbers come from `/api/vitals` (ADR-031), not from here.
 */

/** Chrome DevTools' "Slow 4G" preset. */
const SLOW_4G = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};

const CPU_SLOWDOWN = 4;

const LCP_BUDGET_MS = 4_000;

test.use({ ...devices["Pixel 7"] });

test.beforeEach(async ({ page }) => {
  await preAcceptGate(page);
  await clearInquiryList(page);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
});

/** Largest Contentful Paint as the browser itself recorded it, in milliseconds. */
async function readLcp(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          resolve(entries[entries.length - 1]?.startTime ?? 0);
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }),
  );
}

for (const path of ["/", "/products"]) {
  test(`${path} paints its main content within budget on a slow phone`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();

    const lcp = await readLcp(page);

    expect(lcp).toBeGreaterThan(0);
    expect(lcp).toBeLessThan(LCP_BUDGET_MS);
  });
}

test("a visitor on a slow phone can still add a product", async ({ page }) => {
  await page.goto("/products");

  await page.locator("main li").first().getByRole("button", { name: /^Add / }).click();

  // The header has a mobile layout at this width; the count is announced either way.
  await expect(page.getByRole("link", { name: /Inquiry list, 1 vial/ }).first()).toBeVisible();
});

test("real-user speed data reaches /api/vitals", async ({ page }) => {
  const beacon = page.waitForRequest(
    (request) => request.url().endsWith("/api/vitals") && request.method() === "POST",
  );

  await page.goto("/products");
  await expect(page.locator("h1")).toBeVisible();

  // TTFB and FCP are final on load; a navigation away flushes LCP and CLS too.
  await page.goto("/about");

  const request = await beacon;
  const report = request.postDataJSON() as { name: string; pathname: string };

  expect(["CLS", "FCP", "INP", "LCP", "TTFB"]).toContain(report.name);
  expect(report.pathname).toBe("/products");
});

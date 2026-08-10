import { expect, test } from "@playwright/test";

import { preAcceptGate } from "./helpers";

/**
 * The hero's 3D visual.
 *
 * The assertions are about the things that would silently regress: that the canvas
 * actually gets a WebGL context and sizes itself to its box, that reserving space for
 * it prevents layout shift, that it is invisible to assistive technology, and that
 * `prefers-reduced-motion` really stops the animation rather than merely slowing it.
 */

test.describe("with motion allowed", () => {
  test.beforeEach(async ({ page }) => {
    await preAcceptGate(page);
    await page.goto("/");
  });

  test("mounts a WebGL canvas sized to its square box", async ({ page }) => {
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    const measured = await canvas.evaluate((element) => {
      const canvasElement = element as HTMLCanvasElement;
      const box = canvasElement.getBoundingClientRect();
      const container = canvasElement.closest("[aria-hidden='true']")!.getBoundingClientRect();

      return {
        hasContext: Boolean(
          canvasElement.getContext("webgl2") ?? canvasElement.getContext("webgl"),
        ),
        // The drawing buffer, which is what `dpr` caps.
        bufferWidth: canvasElement.width,
        cssWidth: Math.round(box.width),
        containerWidth: Math.round(container.width),
        containerAspect: Number((container.width / container.height).toFixed(2)),
        dpr: window.devicePixelRatio,
      };
    });

    expect(measured.hasContext).toBe(true);
    // Filled its container rather than staying at the 300×150 HTML default.
    expect(measured.cssWidth).toBe(measured.containerWidth);
    expect(measured.cssWidth).toBeGreaterThan(300);
    expect(measured.containerAspect).toBe(1);

    // dpr is capped at 1.75, so the buffer never exceeds 1.75× the CSS size.
    expect(measured.bufferWidth).toBeLessThanOrEqual(Math.ceil(measured.cssWidth * 1.75) + 1);
  });

  test("is decorative, and does not add anything for a screen reader to read", async ({ page }) => {
    const container = page.locator("canvas").locator("xpath=ancestor::div[@aria-hidden='true'][1]");
    await expect(container).toHaveCount(1);

    // The heading is still the page's only h1 and still the text it was.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Research-grade peptides, documented lot by lot\./,
    );
  });

  test("renders something, rather than a transparent canvas", async ({ page }) => {
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Give the loop a couple of frames, then read the pixels back. A canvas that
    // mounted but drew nothing is the failure this catches — it looks fine in the DOM.
    const drawn = await canvas.evaluate(async (element) => {
      const canvasElement = element as HTMLCanvasElement;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const context = canvasElement.getContext("webgl2") ?? canvasElement.getContext("webgl");
      if (!context) return 0;

      const pixels = new Uint8Array(canvasElement.width * canvasElement.height * 4);
      context.readPixels(
        0,
        0,
        canvasElement.width,
        canvasElement.height,
        context.RGBA,
        context.UNSIGNED_BYTE,
        pixels,
      );

      let opaque = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index]! > 8) opaque += 1;
      }
      return opaque;
    });

    expect(drawn).toBeGreaterThan(0);
  });

  test("reserving the canvas box keeps the hero from shifting as it loads", async ({ page }) => {
    // Measured from first paint, so it covers the placeholder → canvas swap.
    const shift = await page.evaluate(async () => {
      let total = 0;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          if (!layoutShift.hadRecentInput) total += layoutShift.value;
        }
      });

      observer.observe({ type: "layout-shift", buffered: true });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      observer.disconnect();

      return total;
    });

    // Google's "good" CLS threshold is 0.1; the hero alone should be nowhere near it.
    expect(shift).toBeLessThan(0.05);
  });
});

test.describe("with reduced motion requested", () => {
  test("renders a still pose instead of animating", async ({ page }) => {
    // Emulated on the page rather than via `test.use`, which does not carry this
    // option in the installed Playwright's fixture types.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await preAcceptGate(page);
    await page.goto("/");

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    const sample = async () =>
      canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());

    /*
     * Settle first, then compare.
     *
     * In "demand" mode the canvas still redraws on an invalidate — a resize, a DPR
     * change, the initial mount — so sampling immediately raced those and made this
     * test flaky under parallel workers. Waiting for two consecutive identical frames
     * establishes that nothing further is scheduled; only then does a difference a
     * second later mean something is animating.
     */
    let settled = await sample();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await page.waitForTimeout(100);
      const next = await sample();
      if (next === settled) break;
      settled = next;
    }

    await page.waitForTimeout(1000);

    // The model turns at ~0.18 rad/s, so an animating canvas would differ by far more
    // than a rounding error. A still one is byte-identical.
    expect(await sample()).toBe(settled);
  });
});

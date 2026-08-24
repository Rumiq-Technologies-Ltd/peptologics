import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The trust row's hover behaviour.
 *
 * The row's geometry is tested as arithmetic in `utils/steppedRow.test.ts`. What is left
 * here is the wiring that cannot be checked that way, and it has one failure mode worth a
 * test: a tap on a touch screen fires `pointerenter` and, on most mobile browsers, no
 * matching `pointerleave` until the next tap elsewhere. Without the `pointerType` guard a
 * single tap parks the row for good — a stuck row is worse than no hover feature at all,
 * and it is invisible on a desktop where every check is normally run.
 *
 * GSAP is mocked rather than driven. A real timeline needs `requestAnimationFrame` and a
 * layout jsdom does not have, and the assertion is about which calls the component makes,
 * not about whether GSAP can tween.
 */

const timeline = {
  fromTo: vi.fn(() => timeline),
  set: vi.fn(() => timeline),
  duration: vi.fn(() => timeline),
  pause: vi.fn(),
  play: vi.fn(),
  kill: vi.fn(),
};

vi.mock("gsap", () => ({
  default: {
    set: vi.fn(),
    timeline: vi.fn(() => timeline),
  },
}));

// jsdom implements neither, and the component measures with both.
beforeEach(() => {
  vi.clearAllMocks();

  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })),
  );
});

/** The row itself. Decorative and `aria-hidden`, so it is found by class, not by role. */
function renderRow(): HTMLElement {
  const { container } = render(<TrustMarqueeUnderTest />);
  const row = container.querySelector(".stepped-row");

  if (!(row instanceof HTMLElement)) throw new Error("row not rendered");
  return row;
}

const { TrustMarquee: TrustMarqueeUnderTest } =
  await import("@/features/home/components/TrustMarquee");

/**
 * `fireEvent`, not a hand-built `PointerEvent`.
 *
 * jsdom's `PointerEvent` constructor drops `pointerType`, so a hand-built event arrives at
 * the handler with `pointerType: ""` — which the mouse guard correctly rejects, making the
 * test fail for a reason that has nothing to do with the component. Testing Library sets
 * the property on the synthetic event that React actually reads.
 */
function hover(row: HTMLElement, entering: boolean, pointerType: string) {
  const fire = entering ? fireEvent.pointerEnter : fireEvent.pointerLeave;
  fire(row, { pointerType });
}

describe("hover", () => {
  it("pauses under a mouse and resumes when it leaves", () => {
    const row = renderRow();

    hover(row, true, "mouse");
    expect(timeline.pause).toHaveBeenCalledOnce();
    expect(timeline.play).not.toHaveBeenCalled();

    hover(row, false, "mouse");
    expect(timeline.play).toHaveBeenCalledOnce();
  });

  it("ignores touch, so a tap cannot park the row for good", () => {
    const row = renderRow();

    hover(row, true, "touch");

    expect(timeline.pause).not.toHaveBeenCalled();
  });

  it("ignores a pen for the same reason", () => {
    const row = renderRow();

    hover(row, true, "pen");

    expect(timeline.pause).not.toHaveBeenCalled();
  });
});

describe("accessibility", () => {
  it("keeps every repeated copy of a signal out of the accessibility tree", () => {
    const { container } = render(<TrustMarqueeUnderTest />);

    /*
     * The deck is repeated to fill a moving frame, so "Third-party tested" appears several
     * times in the DOM. Exactly one of those is readable: the `sr-only` list. Every other
     * copy sits inside the `aria-hidden` row, which is what stops a screen reader reading
     * the five signals three times over.
     */
    const copies = screen.getAllByText(/Third-party tested/);
    expect(copies.length).toBeGreaterThan(1);

    const readable = copies.filter((node) => !node.closest("[aria-hidden='true']"));
    expect(readable).toHaveLength(1);
    expect(readable[0]?.closest("ul")).toHaveClass("sr-only");

    // And the row that holds the rest is hidden as a whole, not per card.
    expect(container.querySelector(".stepped-row")).toHaveAttribute("aria-hidden", "true");
  });
});

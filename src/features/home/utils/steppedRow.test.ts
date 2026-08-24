import { describe, expect, it } from "vitest";

import {
  cubicBezier,
  fullSlots,
  pitch,
  rowSlots,
  slotOffset,
  stepDelay,
  wrapSlot,
} from "@/features/home/utils/steppedRow";

/**
 * The trust row's geometry.
 *
 * Worth testing rather than eyeballing: the row is modular arithmetic over a ring of
 * slots, and every way it can be wrong looks the same from the outside — a gap that opens
 * up, a card that pops into view mid-frame, a lattice that drifts a few pixels per lap
 * until it is visibly crooked. None of that is catchable by glancing at a moving row.
 */

const CONFIG = {
  cardWidth: 248,
  gap: 18,
  cycle: 2,
  duration: 1.5,
  stagger: 0.045,
};

/** A desktop frame: 1265px fits four 266px pitches with room to spare. */
const WIDTH = 1265;

describe("slot counting", () => {
  it("counts only the cards that fit completely", () => {
    expect(pitch(CONFIG)).toBe(266);
    // 4 * 266 - 18 = 1046, and a fifth would need 1312.
    expect(fullSlots(WIDTH, CONFIG)).toBe(4);
  });

  it("adds three: one bleeding off each edge, one parked off-frame to wrap into", () => {
    expect(rowSlots(WIDTH, CONFIG)).toBe(7);
  });

  it("never drops below one card, however narrow the frame", () => {
    // A 200px frame cannot fit a 248px card at all, but a row of zero cards is not a
    // degraded row, it is a blank band.
    expect(fullSlots(200, CONFIG)).toBe(1);
    expect(rowSlots(200, CONFIG)).toBe(4);
  });
});

describe("slot offsets", () => {
  it("spaces every slot exactly one pitch apart", () => {
    const offsets = Array.from({ length: 7 }, (_, slot) => slotOffset(slot, WIDTH, CONFIG));
    const gaps = offsets.slice(1).map((offset, i) => offset - offsets[i]!);

    expect(gaps).toEqual([266, 266, 266, 266, 266, 266]);
  });

  it("centres the visible run, so the bleed past each edge is symmetric", () => {
    // Slot 1 is the first fully visible card; slot 4 is the last.
    const leading = slotOffset(1, WIDTH, CONFIG);
    const trailing = WIDTH - (slotOffset(4, WIDTH, CONFIG) + CONFIG.cardWidth);

    expect(leading).toBeCloseTo(trailing, 6);
  });

  it("leaves slot 0 as a partly visible sliver, not a hidden card", () => {
    const offset = slotOffset(0, WIDTH, CONFIG);

    // It straddles the leading edge: cut off on the left, visible on the right. That
    // sliver is what stops the row reading as a list that begins at the frame edge.
    expect(offset).toBeLessThan(0);
    expect(offset + CONFIG.cardWidth).toBeGreaterThan(0);
  });

  it("puts the step past slot 0 fully off-frame, so the teleport is never seen", () => {
    // A card leaving slot 0 travels to slot -1 before being moved to the far end. If any
    // of slot -1 were still visible, that jump would be a visible pop.
    expect(slotOffset(-1, WIDTH, CONFIG) + CONFIG.cardWidth).toBeLessThanOrEqual(0);
  });

  it("puts the last slot past the trailing edge, so a wrapped card enters from outside", () => {
    const last = rowSlots(WIDTH, CONFIG) - 1;

    expect(slotOffset(last, WIDTH, CONFIG)).toBeGreaterThanOrEqual(WIDTH);
  });
});

describe("the loop", () => {
  /**
   * The invariant that makes the row seamless: after one step per slot, every card is back
   * where it started. If this drifts by even a pixel, the lattice skews a little more on
   * every lap.
   */
  it("returns every card to its starting slot after a full rotation", () => {
    const slots = rowSlots(WIDTH, CONFIG);

    for (let card = 0; card < slots; card++) {
      let slot = card;
      for (let step = 0; step < slots; step++) {
        slot = wrapSlot(slot - 1, slots);
      }
      expect(slot).toBe(card);
    }
  });

  it("keeps every slot occupied at every step, so no gap ever opens in the row", () => {
    const slots = rowSlots(WIDTH, CONFIG);

    for (let step = 0; step < slots; step++) {
      const occupied = Array.from({ length: slots }, (_, card) => wrapSlot(card - step, slots));

      expect(new Set(occupied).size).toBe(slots);
    }
  });
});

describe("step timing", () => {
  it("staggers adjacent slots, which is what shears the row mid-step", () => {
    expect(stepDelay(0, WIDTH, CONFIG)).toBe(0);
    expect(stepDelay(1, WIDTH, CONFIG)).toBeGreaterThan(0);
    expect(stepDelay(2, WIDTH, CONFIG)).toBeGreaterThan(stepDelay(1, WIDTH, CONFIG));
  });

  it("lands the last card before the next step begins", () => {
    const slots = rowSlots(WIDTH, CONFIG);
    const latest = Math.max(
      ...Array.from({ length: slots }, (_, slot) => stepDelay(slot, WIDTH, CONFIG)),
    );

    // A card still travelling when the next step starts gets yanked, and the row drifts.
    expect(latest + CONFIG.duration).toBeLessThanOrEqual(CONFIG.cycle);
  });

  it("stops growing past the visible run, so off-frame cards do not lag further and further", () => {
    const visible = fullSlots(WIDTH, CONFIG);

    expect(stepDelay(visible + 1, WIDTH, CONFIG)).toBe(stepDelay(visible + 5, WIDTH, CONFIG));
  });

  it("caps the stagger when the cycle has no headroom for it", () => {
    // duration === cycle: there is no still moment, so any stagger at all would overrun.
    const tight = { ...CONFIG, duration: 2 };

    expect(stepDelay(3, WIDTH, tight)).toBe(0);
  });
});

describe("cubicBezier", () => {
  const ease = cubicBezier([0.45, 0, 0.15, 1]);

  it("is pinned at both ends", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    // Clamped rather than extrapolated — GSAP can overshoot progress on a fast scrub.
    expect(ease(-0.5)).toBe(0);
    expect(ease(1.5)).toBe(1);
  });

  it("rises monotonically, so a card never moves backwards inside a step", () => {
    let previous = -1;

    for (let x = 0; x <= 1.0001; x += 0.02) {
      const y = ease(Math.min(1, x));
      expect(y).toBeGreaterThanOrEqual(previous);
      previous = y;
    }
  });

  it("matches the curve it was given", () => {
    /*
     * [0.45, 0, 0.15, 1] is a hard ease-in-out, and deliberately not symmetric: it eases
     * in gently, covers most of the pitch in the middle third, then settles. Pinning a few
     * points is what would catch a transposed control point, which otherwise still looks
     * like "some easing" and moves the row wrong.
     */
    expect(ease(0.1)).toBeCloseTo(0.0206, 3);
    expect(ease(0.25)).toBeCloseTo(0.2068, 3);
    expect(ease(0.5)).toBeCloseTo(0.7912, 3);
    expect(ease(0.9)).toBeCloseTo(0.995, 3);

    // The shape those numbers describe: a slow start, then ahead of linear from the
    // quarter mark onwards.
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.5)).toBeGreaterThan(0.5);
  });

  it("stays well inside a pixel of a linear reference at the ends", () => {
    // The row travels 266px per step; 1e-4 of that is far below a device pixel.
    expect(Math.abs(ease(0.001))).toBeLessThan(1e-3);
    expect(Math.abs(1 - ease(0.999))).toBeLessThan(1e-3);
  });
});

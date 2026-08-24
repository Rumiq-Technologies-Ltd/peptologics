/**
 * The geometry and timing behind the trust bar's stepped row.
 *
 * Pure functions, no React, no GSAP and no DOM, which is the point: the row is modular
 * arithmetic over a ring of slots, and arithmetic that is only ever exercised by looking
 * at a moving row is arithmetic nobody checks. `TrustMarquee.tsx` supplies the elements
 * and the timeline; everything that decides *where* a card belongs lives here.
 *
 * The model: a fixed number of slots laid out left to right at a constant pitch. Slot 0
 * is off the leading edge, the fully visible run is centred, and one slot is parked past
 * the trailing edge. Every card steps from its slot to the one before it, and a card
 * leaving slot 0 is teleported to the last slot — off-frame, so the jump is never seen.
 */

export interface SteppedRowConfig {
  /** Card width in px. */
  cardWidth: number;
  /** Space between cards in px. */
  gap: number;
  /** Seconds between steps. */
  cycle: number;
  /** Seconds one step takes. Must be less than `cycle`, or a card is still moving when
   *  the next step begins. */
  duration: number;
  /** Seconds between adjacent cards starting their step. The shear. */
  stagger: number;
}

/** Distance from one card's leading edge to the next. */
export function pitch(config: SteppedRowConfig): number {
  return config.cardWidth + config.gap;
}

/** How many cards fit the frame completely. At least one, even in a frame too narrow. */
export function fullSlots(width: number, config: SteppedRowConfig): number {
  return Math.max(1, Math.floor((width + config.gap) / pitch(config)));
}

/**
 * How many cards have to exist for the row to look infinite: every fully visible slot,
 * one bleeding off each edge, and one parked out of frame that a wrapping card can be
 * teleported into.
 */
export function rowSlots(width: number, config: SteppedRowConfig): number {
  return fullSlots(width, config) + 3;
}

/**
 * The x offset of a slot, in px from the frame's left edge.
 *
 * The fully visible run is centred, which leaves a symmetric sliver of the neighbouring
 * card bleeding past each edge. Slot 0 is that leading sliver, so it sits one pitch behind
 * the first fully visible card — which means slot 0's offset is negative, and slot −1
 * (where a wrapping card is heading) is further off-frame still.
 */
export function slotOffset(slot: number, width: number, config: SteppedRowConfig): number {
  const step = pitch(config);
  const visible = fullSlots(width, config);
  const margin = (width - (visible * step - config.gap)) / 2;

  return margin + (slot - 1) * step;
}

/**
 * When a card in a given slot starts its step, in seconds after the cycle begins.
 *
 * Leading slots start first, so the row shears in the direction of travel. Two clamps
 * matter. The delay stops growing past the last visible slot, so the off-frame cards do
 * not accumulate an ever-larger offset; and the whole stagger is capped so the last card
 * to move still finishes inside the cycle — a card still travelling when the next step
 * begins would be yanked, and the row would drift out of its lattice.
 */
export function stepDelay(slot: number, width: number, config: SteppedRowConfig): number {
  const visible = fullSlots(width, config);
  const headroom = Math.max(0, config.cycle - config.duration);
  const cap = Math.min(config.stagger, headroom / Math.max(1, visible + 1));

  return Math.min(slot, visible + 1) * cap;
}

/** Positive modulo, so a card stepping past slot 0 wraps to the end of the ring. */
export function wrapSlot(slot: number, slots: number): number {
  return ((slot % slots) + slots) % slots;
}

/**
 * A cubic-bezier easing function, Newton-refined.
 *
 * GSAP takes a plain `(progress) => progress` function as an ease and its CustomEase
 * plugin is not needed for this: six Newton iterations against the curve's own derivative
 * invert x(t) closely enough that the error is far below a pixel at these distances.
 */
export function cubicBezier([x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 6; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) break;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }

    return ((ay * t + by) * t + cy) * t;
  };
}

import { describe, expect, it } from "vitest";

import { recentMonths } from "@/features/admin/orders/utils/orderMonths";

describe("recentMonths", () => {
  it("lists the current UTC month first and walks back across a year end", () => {
    expect(recentMonths(new Date("2026-02-15T12:00:00Z"), 4)).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
    ]);
  });

  it("uses UTC, not the server's zone, at a month boundary", () => {
    expect(recentMonths(new Date("2026-12-01T00:30:00Z"), 1)).toEqual(["2026-12"]);
    expect(recentMonths(new Date("2026-11-30T23:30:00Z"), 1)).toEqual(["2026-11"]);
  });
});

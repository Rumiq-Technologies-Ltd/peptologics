import { describe, expect, it } from "vitest";

import { webVitalSchema } from "@/lib/validations/webVitals.schema";

const VALID_REPORT = {
  name: "LCP",
  value: 1830.4,
  rating: "good",
  id: "v5-1730000000000-1234567890123",
  navigationType: "navigate",
  pathname: "/products",
};

describe("webVitalSchema", () => {
  it("accepts a real report", () => {
    expect(webVitalSchema.safeParse(VALID_REPORT).success).toBe(true);
  });

  it("accepts a CLS score, which is unitless", () => {
    const report = { ...VALID_REPORT, name: "CLS", value: 0.04 };
    expect(webVitalSchema.safeParse(report).success).toBe(true);
  });

  it("rejects a metric it does not know", () => {
    const report = { ...VALID_REPORT, name: "FID" };
    expect(webVitalSchema.safeParse(report).success).toBe(false);
  });

  it.each([-1, Number.POSITIVE_INFINITY, 60_001])("rejects an impossible timing of %s", (value) => {
    expect(webVitalSchema.safeParse({ ...VALID_REPORT, value }).success).toBe(false);
  });

  it("rejects an impossible CLS score", () => {
    const report = { ...VALID_REPORT, name: "CLS", value: 11 };
    expect(webVitalSchema.safeParse(report).success).toBe(false);
  });

  it("rejects a full URL in place of a path", () => {
    const report = { ...VALID_REPORT, pathname: "https://example.com/products" };
    expect(webVitalSchema.safeParse(report).success).toBe(false);
  });

  it("rejects an oversized path", () => {
    const report = { ...VALID_REPORT, pathname: `/${"a".repeat(200)}` };
    expect(webVitalSchema.safeParse(report).success).toBe(false);
  });
});

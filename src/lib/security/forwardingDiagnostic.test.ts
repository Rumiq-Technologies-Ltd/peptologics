import { describe, expect, it } from "vitest";

import { describeForwardingHeaders } from "@/lib/security/forwardingDiagnostic";

describe("describeForwardingHeaders", () => {
  it("counts x-forwarded-for entries and lists the present diagnostic headers", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9, 198.51.100.7, 192.0.2.1",
      "cloudfront-viewer-address": "203.0.113.9:443",
      "x-amzn-trace-id": "Root=1-abc",
    });

    expect(describeForwardingHeaders(headers)).toEqual({
      xffEntryCount: 3,
      presentHeaders: ["x-forwarded-for", "cloudfront-viewer-address", "x-amzn-trace-id"],
    });
  });

  it("reports zero entries and no headers when none are sent", () => {
    expect(describeForwardingHeaders(new Headers())).toEqual({
      xffEntryCount: 0,
      presentHeaders: [],
    });
  });

  it("never includes a header value in its output", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9, 198.51.100.7",
      "x-real-ip": "198.51.100.7",
    });

    const output = JSON.stringify(describeForwardingHeaders(headers));

    expect(output).not.toContain("203.0.113.9");
    expect(output).not.toContain("198.51.100.7");
  });
});
